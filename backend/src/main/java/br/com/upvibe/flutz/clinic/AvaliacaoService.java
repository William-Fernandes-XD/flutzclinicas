package br.com.upvibe.flutz.clinic;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class AvaliacaoService {

    private final JdbcTemplate jdbc;

    public AvaliacaoService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<AvaliacaoPublica> listarPorEmpresa(Integer empresaId) {
        if (empresaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a clínica");
        }
        return jdbc.query(
                """
                SELECT a.avaliacao_id, a.nota, a.comentario, a.data_criacao,
                       c.nome_cliente, c.foto_url
                FROM flutz.avaliacao a
                JOIN flutz.cliente c ON c.cliente_id = a.cliente_id
                WHERE a.empresa_id = ?
                ORDER BY a.data_criacao DESC
                """,
                (rs, i) -> new AvaliacaoPublica(
                        rs.getInt("avaliacao_id"),
                        rs.getBigDecimal("nota"),
                        rs.getString("comentario"),
                        rs.getTimestamp("data_criacao").toInstant().toString(),
                        rs.getString("nome_cliente"),
                        rs.getString("foto_url")
                ),
                empresaId
        );
    }

    public List<Pendente> pendentesTutor() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor");
        }
        List<Pendente> itens = jdbc.query(
                """
                SELECT a.atendimento_id AS origem_id, 'ATENDIMENTO' AS origem, e.empresa_id, e.nome_empresa,
                       p.pet_id, p.nome_pet, a.data_inicio AS quando_ts, NULL::date AS quando_date
                FROM flutz.atendimento a
                JOIN flutz.atendimento_status st ON st.atendimento_status_id = a.atendimento_status_id
                JOIN flutz.empresa e ON e.empresa_id = a.empresa_id
                JOIN flutz.pet p ON p.pet_id = a.pet_id
                WHERE a.cliente_id = ?
                  AND LOWER(st.descricao) = 'concluido'
                  AND NOT EXISTS (
                    SELECT 1 FROM flutz.avaliacao av
                    WHERE av.empresa_id = a.empresa_id AND av.cliente_id = a.cliente_id
                  )
                UNION ALL
                SELECT h.historico_vacinacao_id, 'VACINACAO', col.empresa_id, e.nome_empresa,
                       p.pet_id, p.nome_pet, NULL::timestamp, h.data_aplicacao
                FROM flutz.historico_vacinacao h
                JOIN flutz.pet p ON p.pet_id = h.pet_id
                JOIN flutz.colaborador col ON col.colaborador_id = h.colaborador_id
                JOIN flutz.empresa e ON e.empresa_id = col.empresa_id
                WHERE p.cliente_id = ?
                  AND NOT EXISTS (
                    SELECT 1 FROM flutz.avaliacao av
                    WHERE av.empresa_id = col.empresa_id AND av.cliente_id = p.cliente_id
                  )
                ORDER BY COALESCE(quando_ts, quando_date::timestamp) DESC NULLS LAST, origem_id DESC
                """,
                (rs, i) -> new Pendente(
                        rs.getInt("origem_id"),
                        rs.getString("origem"),
                        rs.getInt("empresa_id"),
                        rs.getString("nome_empresa"),
                        rs.getInt("pet_id"),
                        rs.getString("nome_pet"),
                        rs.getTimestamp("quando_ts") != null
                                ? rs.getTimestamp("quando_ts").toInstant().toString()
                                : (rs.getDate("quando_date") == null ? null : rs.getDate("quando_date").toLocalDate().toString())
                ),
                auth.atorId(), auth.atorId()
        );
        // Uma pendência por clínica (a mais recente).
        java.util.LinkedHashMap<Integer, Pendente> porClinica = new java.util.LinkedHashMap<>();
        for (Pendente item : itens) {
            porClinica.putIfAbsent(item.empresaId(), item);
        }
        return List.copyOf(porClinica.values());
    }

    @Transactional
    public AvaliacaoPublica criar(NovaAvaliacao req) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor avalia");
        }
        if (req.nota() == null || req.nota().compareTo(BigDecimal.ONE) < 0 || req.nota().compareTo(new BigDecimal("5")) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A nota deve ser de 1 a 5");
        }
        String origem = req.origem() == null ? "" : req.origem().trim().toUpperCase(Locale.ROOT);
        Integer atendimentoId = null;
        Integer vacinaId = null;
        Integer empresaId;
        if ("ATENDIMENTO".equals(origem)) {
            if (req.origemId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o atendimento");
            }
            var row = jdbc.query(
                    """
                    SELECT a.empresa_id, a.cliente_id, LOWER(st.descricao) AS status
                    FROM flutz.atendimento a
                    JOIN flutz.atendimento_status st ON st.atendimento_status_id = a.atendimento_status_id
                    WHERE a.atendimento_id = ?
                    """,
                    rs -> rs.next()
                            ? new Object[] { rs.getInt("empresa_id"), rs.getInt("cliente_id"), rs.getString("status") }
                            : null,
                    req.origemId()
            );
            if (row == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Atendimento não encontrado");
            }
            if (!auth.atorId().equals(row[1])) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este atendimento não é seu");
            }
            if (!"concluido".equals(row[2])) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Só é possível avaliar após o atendimento ser concluído");
            }
            atendimentoId = req.origemId();
            empresaId = (Integer) row[0];
        } else if ("VACINACAO".equals(origem)) {
            if (req.origemId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a vacinação");
            }
            var row = jdbc.query(
                    """
                    SELECT col.empresa_id, p.cliente_id
                    FROM flutz.historico_vacinacao h
                    JOIN flutz.pet p ON p.pet_id = h.pet_id
                    JOIN flutz.colaborador col ON col.colaborador_id = h.colaborador_id
                    WHERE h.historico_vacinacao_id = ?
                    """,
                    rs -> rs.next() ? new Object[] { rs.getInt("empresa_id"), rs.getInt("cliente_id") } : null,
                    req.origemId()
            );
            if (row == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vacinação não encontrada");
            }
            if (!auth.atorId().equals(row[1])) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Esta vacinação não é sua");
            }
            vacinaId = req.origemId();
            empresaId = (Integer) row[0];
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Origem inválida");
        }

        Long jaClinica = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flutz.avaliacao WHERE empresa_id = ? AND cliente_id = ?",
                Long.class,
                empresaId,
                auth.atorId()
        );
        if (jaClinica != null && jaClinica > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Você já avaliou esta clínica");
        }

        String comentario = req.comentario() == null || req.comentario().isBlank() ? null : req.comentario().trim();
        Integer id = jdbc.queryForObject(
                """
                INSERT INTO flutz.avaliacao (empresa_id, cliente_id, nota, comentario, atendimento_id, historico_vacinacao_id)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING avaliacao_id
                """,
                Integer.class,
                empresaId,
                auth.atorId(),
                req.nota(),
                comentario,
                atendimentoId,
                vacinaId
        );
        espelharAvaliacaoNaPagina(empresaId, auth.atorId(), atendimentoId, vacinaId, req.nota(), comentario);
        return listarPorEmpresa(empresaId).stream()
                .filter(item -> item.id().equals(id))
                .findFirst()
                .orElseThrow();
    }

    private void espelharAvaliacaoNaPagina(
            Integer empresaId,
            Integer clienteId,
            Integer atendimentoId,
            Integer vacinaId,
            BigDecimal nota,
            String comentario
    ) {
        var contexto = jdbc.query(
                """
                SELECT c.nome_cliente,
                       COALESCE(at.pet_id, h.pet_id) AS pet_id,
                       p.nome_pet
                FROM flutz.cliente c
                LEFT JOIN flutz.atendimento at ON at.atendimento_id = ?
                LEFT JOIN flutz.historico_vacinacao h ON h.historico_vacinacao_id = ?
                LEFT JOIN flutz.pet p ON p.pet_id = COALESCE(at.pet_id, h.pet_id)
                WHERE c.cliente_id = ?
                """,
                rs -> rs.next()
                        ? new Object[] { rs.getString("nome_cliente"), (Integer) rs.getObject("pet_id"), rs.getString("nome_pet") }
                        : null,
                atendimentoId,
                vacinaId,
                clienteId
        );
        if (contexto == null) {
            return;
        }
        String texto = comentario == null || comentario.isBlank() ? "Avaliação sem comentário." : comentario;
        jdbc.update(
                """
                INSERT INTO flutz.avaliacao_cliente (
                  empresa_id, cliente_id, pet_id, nome_cliente, nome_pet, texto, nota,
                  visivel, autorizado_publicacao, data_autorizacao, status_id
                )
                SELECT ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, CURRENT_TIMESTAMP, status_id
                FROM flutz.status
                WHERE LOWER(descricao) = 'ativo'
                  AND NOT EXISTS (
                    SELECT 1 FROM flutz.avaliacao_cliente ac
                    WHERE ac.empresa_id = ? AND ac.cliente_id = ?
                      AND ac.data_avaliacao::date = CURRENT_DATE
                      AND ac.nota = ?
                  )
                """,
                empresaId,
                clienteId,
                contexto[1],
                contexto[0],
                contexto[2],
                texto,
                nota,
                empresaId,
                clienteId,
                nota
        );
    }

    public record AvaliacaoPublica(
            Integer id,
            BigDecimal nota,
            String comentario,
            String quando,
            String tutor,
            String fotoUrl
    ) {
    }

    public record Pendente(
            Integer origemId,
            String origem,
            Integer empresaId,
            String clinica,
            Integer petId,
            String pet,
            String quando
    ) {
    }

    public record NovaAvaliacao(String origem, Integer origemId, BigDecimal nota, String comentario) {
    }
}
