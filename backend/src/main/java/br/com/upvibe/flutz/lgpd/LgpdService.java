package br.com.upvibe.flutz.lgpd;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.clinic.NotificationService;
import br.com.upvibe.flutz.config.AppProperties;
import br.com.upvibe.flutz.mail.EmailService;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class LgpdService {

    private static final Logger log = LoggerFactory.getLogger(LgpdService.class);
    private static final Set<String> TIPOS = Set.of(
            "ACESSO", "CORRECAO", "ANONIMIZACAO", "EXCLUSAO", "PORTABILIDADE",
            "REVOGACAO_CONSENTIMENTO"
    );
    private static final Set<String> STATUS_ADMIN = Set.of("EM_ANDAMENTO", "CONCLUIDA", "NEGADA");

    private final JdbcTemplate jdbc;
    private final EmailService email;
    private final AppProperties properties;
    private final NotificationService notifications;

    public LgpdService(
            JdbcTemplate jdbc,
            EmailService email,
            AppProperties properties,
            NotificationService notifications
    ) {
        this.jdbc = jdbc;
        this.email = email;
        this.properties = properties;
        this.notifications = notifications;
    }

    public List<SolicitacaoLgpd> listarMinhas() {
        AuthPrincipal auth = titularAtual();
        return jdbc.query(
                """
                SELECT solicitacao_titular_id, empresa_id, titular_tipo, titular_id, tipo_solicitacao,
                       status_solicitacao, detalhamento, motivo_negativa, data_solicitacao,
                       data_conclusao, data_solicitacao + INTERVAL '15 days' AS prazo_limite
                FROM flutz.solicitacao_titular
                WHERE titular_tipo = ? AND titular_id = ?
                ORDER BY data_solicitacao DESC
                """,
                (rs, row) -> mapSolicitacao(rs),
                auth.tipo().name(), auth.atorId()
        );
    }

    @Transactional
    public ResultadoSolicitacao criar(NovaSolicitacao req) {
        AuthPrincipal auth = titularAtual();
        String tipo = normalizarTipo(req == null ? null : req.tipoSolicitacao());
        String detalhe = limpar(req == null ? null : req.detalhamento(), 4000);
        if ("CORRECAO".equals(tipo) && detalhe == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Descreva os dados que precisam de correção");
        }

        if ("REVOGACAO_CONSENTIMENTO".equals(tipo)) {
            SolicitacaoLgpd criada = inserir(auth, tipo, detalhe, "CONCLUIDA");
            notificarCriacao(criada, auth);
            String tabela = auth.tutor() ? "cliente" : "colaborador";
            String colunaId = auth.tutor() ? "cliente_id" : "colaborador_id";
            jdbc.update(
                    "UPDATE flutz." + tabela + " SET permitir_notificacoes = FALSE WHERE " + colunaId + " = ?",
                    auth.atorId()
            );
            return new ResultadoSolicitacao(criada, null);
        }
        if ("ACESSO".equals(tipo) || "PORTABILIDADE".equals(tipo)) {
            PacotePortabilidade pacote = pacote(auth, "ACESSO".equals(tipo));
            SolicitacaoLgpd criada = inserir(auth, tipo, detalhe, "CONCLUIDA");
            notificarCriacao(criada, auth);
            return new ResultadoSolicitacao(criada, pacote);
        }

        SolicitacaoLgpd criada = inserir(auth, tipo, detalhe, "ABERTA");
        notificarCriacao(criada, auth);
        if ("EXCLUSAO".equals(tipo) || "ANONIMIZACAO".equals(tipo)) {
            avisarAdministracao(criada, auth);
        }
        return new ResultadoSolicitacao(criada, null);
    }

    @Transactional
    public PacotePortabilidade exportacao() {
        AuthPrincipal auth = titularAtual();
        registrarUmaVezAoDia(auth, "PORTABILIDADE");
        return pacote(auth, false);
    }

    @Transactional
    public PacotePortabilidade acesso() {
        AuthPrincipal auth = titularAtual();
        registrarUmaVezAoDia(auth, "ACESSO");
        return pacote(auth, true);
    }

    public List<SolicitacaoLgpd> listarAdmin() {
        exigirAdmin();
        return jdbc.query(
                """
                SELECT s.solicitacao_titular_id, s.empresa_id, s.titular_tipo, s.titular_id,
                       s.tipo_solicitacao, s.status_solicitacao, s.detalhamento, s.motivo_negativa,
                       s.data_solicitacao, s.data_conclusao,
                       s.data_solicitacao + INTERVAL '15 days' AS prazo_limite
                FROM flutz.solicitacao_titular s
                ORDER BY CASE WHEN s.status_solicitacao IN ('ABERTA', 'EM_ANDAMENTO') THEN 0 ELSE 1 END,
                         s.data_solicitacao
                """,
                (rs, row) -> mapSolicitacao(rs)
        );
    }

    @Transactional
    public SolicitacaoLgpd atualizarStatus(Integer id, AtualizacaoStatus req) {
        exigirAdmin();
        String status = req == null || req.status() == null ? "" : req.status().trim().toUpperCase();
        if (!STATUS_ADMIN.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status inválido");
        }
        String motivo = limpar(req.motivoNegativa(), 4000);
        if ("NEGADA".equals(status) && motivo == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o motivo da negativa");
        }
        int alteradas = jdbc.update(
                """
                UPDATE flutz.solicitacao_titular
                SET status_solicitacao = ?, motivo_negativa = ?,
                    data_conclusao = CASE WHEN ? IN ('CONCLUIDA', 'NEGADA') THEN CURRENT_TIMESTAMP ELSE NULL END
                WHERE solicitacao_titular_id = ?
                """,
                status, "NEGADA".equals(status) ? motivo : null, status, id
        );
        if (alteradas == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitação não encontrada");
        }
        SolicitacaoLgpd atualizada = porId(id);
        notificarStatus(atualizada);
        return atualizada;
    }

    @Transactional
    public SolicitacaoLgpd anonimizar(Integer id) {
        AuthPrincipal admin = exigirAdmin();
        SolicitacaoLgpd solicitacao = porId(id);
        if (!Set.of("EXCLUSAO", "ANONIMIZACAO").contains(solicitacao.tipoSolicitacao())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esta solicitação não permite anonimização");
        }
        if ("CONCLUIDA".equals(solicitacao.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A solicitação já foi concluída");
        }

        jdbc.update(
                """
                UPDATE flutz.solicitacao_titular
                SET status_solicitacao = 'CONCLUIDA', motivo_negativa = NULL, data_conclusao = CURRENT_TIMESTAMP
                WHERE solicitacao_titular_id = ?
                """,
                id
        );
        SolicitacaoLgpd concluidaPre = porId(id);
        notificarStatus(concluidaPre);

        int statusInativo = jdbc.queryForObject(
                "SELECT status_id FROM flutz.status WHERE LOWER(descricao) IN ('inativo', 'desativado') ORDER BY status_id LIMIT 1",
                Integer.class
        );
        String opaco = codigoAnonimo(solicitacao.titularId());
        int alteradas;
        if ("CLIENTE".equals(solicitacao.titularTipo())) {
            alteradas = jdbc.update(
                    """
                    UPDATE flutz.cliente
                    SET nome_cliente = 'Titular removido', cpf = ?, email = NULL, telefone = NULL,
                        foto_url = NULL, permitir_notificacoes = FALSE, anonimizado_em = CURRENT_TIMESTAMP,
                        status_id = ?
                    WHERE cliente_id = ?
                    """,
                    opaco, statusInativo, solicitacao.titularId()
            );
        } else if ("COLABORADOR".equals(solicitacao.titularTipo())) {
            alteradas = jdbc.update(
                    """
                    UPDATE flutz.colaborador
                    SET nome_colaborador = 'Titular removido', cpf = ?, email = ?, telefone = NULL,
                        imagem_url = NULL, permitir_notificacoes = FALSE, anonimizado_em = CURRENT_TIMESTAMP,
                        status_id = ?, exibir_pagina = FALSE, data_autorizacao_pagina = NULL
                    WHERE colaborador_id = ?
                    """,
                    opaco, "anon" + solicitacao.titularId() + "." + Instant.now().toEpochMilli() + "@invalid.local",
                    statusInativo, solicitacao.titularId()
            );
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de titular não pode ser anonimizado");
        }
        if (alteradas == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Titular não encontrado");
        }
        jdbc.update(
                """
                INSERT INTO flutz.auditoria_acao
                    (empresa_id, ator_tipo, ator_id, pagina, botao, detalhamento)
                VALUES (?, 'ADMINISTRADOR_SISTEMA', ?, '/admin/lgpd', 'Anonimizar',
                        'Anonimização LGPD concluída para solicitação #' || ?)
                """,
                solicitacao.empresaId(), admin.atorId(), id
        );
        return porId(id);
    }

    private PacotePortabilidade pacote(AuthPrincipal auth, boolean simplificado) {
        Map<String, Object> perfil;
        List<Map<String, Object>> pets = List.of();
        List<Map<String, Object>> agendamentos = List.of();
        List<Map<String, Object>> vacinacoes = List.of();
        List<Map<String, Object>> chats = List.of();
        List<Map<String, Object>> papeis = List.of();

        if (auth.tutor()) {
            perfil = primeiraLinha(
                    """
                    SELECT cliente_id AS id, nome_cliente AS nome, cpf, telefone, email,
                           permitir_notificacoes, anonimizado_em, data_criacao
                    FROM flutz.cliente WHERE cliente_id = ?
                    """,
                    auth.atorId()
            );
            if (!simplificado) {
                pets = jdbc.queryForList(
                        """
                        SELECT p.pet_id AS id, p.nome_pet AS nome, e.descricao AS especie,
                               r.descricao AS raca, p.sexo, p.data_aniversario, p.peso,
                               emp.nome_empresa AS clinica
                        FROM flutz.pet p
                        JOIN flutz.pet_especie e ON e.pet_especie_id = p.pet_especie_id
                        LEFT JOIN flutz.pet_raca r ON r.pet_raca_id = p.pet_raca_id
                        JOIN flutz.empresa emp ON emp.empresa_id = p.empresa_id
                        WHERE p.cliente_id = ? ORDER BY p.pet_id
                        """,
                        auth.atorId()
                );
                agendamentos = jdbc.queryForList(
                        """
                        SELECT a.agendamento_id AS id, emp.nome_empresa AS clinica, p.nome_pet AS pet,
                               a.data_hora_inicio AS inicio, a.data_hora_fim AS fim,
                               st.descricao AS status, a.origem, a.observacoes
                        FROM flutz.agendamento a
                        JOIN flutz.empresa emp ON emp.empresa_id = a.empresa_id
                        JOIN flutz.pet p ON p.pet_id = a.pet_id
                        JOIN flutz.agendamento_status st ON st.agendamento_status_id = a.agendamento_status_id
                        WHERE a.cliente_id = ? ORDER BY a.data_hora_inicio DESC
                        """,
                        auth.atorId()
                );
                vacinacoes = jdbc.queryForList(
                        """
                        SELECT h.historico_vacinacao_id AS id, p.nome_pet AS pet, v.nome_vacina AS vacina,
                               h.data_aplicacao, h.data_proxima_dose, h.lote, h.observacoes
                        FROM flutz.historico_vacinacao h
                        JOIN flutz.pet p ON p.pet_id = h.pet_id
                        JOIN flutz.vacina v ON v.vacina_id = h.vacina_id
                        WHERE p.cliente_id = ? ORDER BY h.data_aplicacao DESC
                        """,
                        auth.atorId()
                );
                chats = jdbc.queryForList(
                        """
                        SELECT c.chat_id AS id, emp.nome_empresa AS clinica, p.nome_pet AS pet,
                               s.descricao AS status, c.data_criacao AS criado_em,
                               c.ultima_atualizacao AS ultima_atividade,
                               (SELECT COUNT(*) FROM flutz.chat_mensagem m WHERE m.chat_id = c.chat_id) AS mensagens
                        FROM flutz.chat c
                        JOIN flutz.empresa emp ON emp.empresa_id = c.empresa_id
                        LEFT JOIN flutz.pet p ON p.pet_id = c.pet_id
                        JOIN flutz.status s ON s.status_id = c.status_id
                        WHERE c.cliente_id = ? ORDER BY c.ultima_atualizacao DESC
                        """,
                        auth.atorId()
                );
            }
        } else {
            perfil = primeiraLinha(
                    """
                    SELECT c.colaborador_id AS id, c.nome_colaborador AS nome, c.cpf, c.email,
                           c.telefone, c.cargo, c.funcao, c.descricao, c.permitir_notificacoes,
                           c.anonimizado_em, c.data_criacao, e.empresa_id, e.nome_empresa AS clinica
                    FROM flutz.colaborador c
                    JOIN flutz.empresa e ON e.empresa_id = c.empresa_id
                    WHERE c.colaborador_id = ?
                    """,
                    auth.atorId()
            );
            papeis = jdbc.queryForList(
                    """
                    SELECT r.descricao AS papel
                    FROM flutz.colaborador_role cr
                    JOIN flutz.role r ON r.role_id = cr.role_id
                    WHERE cr.colaborador_id = ?
                    ORDER BY r.descricao
                    """,
                    auth.atorId()
            );
        }
        if (perfil.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil não encontrado");
        }
        return new PacotePortabilidade(
                Instant.now().toString(), auth.tipo().name(), perfil, pets, agendamentos, vacinacoes, chats, papeis
        );
    }

    private Map<String, Object> primeiraLinha(String sql, Object... args) {
        List<Map<String, Object>> linhas = jdbc.queryForList(sql, args);
        return linhas.isEmpty() ? Map.of() : new LinkedHashMap<>(linhas.getFirst());
    }

    private void registrarUmaVezAoDia(AuthPrincipal auth, String tipo) {
        Integer existe = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM flutz.solicitacao_titular
                WHERE titular_tipo = ? AND titular_id = ? AND tipo_solicitacao = ?
                  AND data_solicitacao >= CURRENT_DATE
                """,
                Integer.class, auth.tipo().name(), auth.atorId(), tipo
        );
        if (existe == null || existe == 0) {
            inserir(auth, tipo, "Gerada pelo Centro de Privacidade", "CONCLUIDA");
        }
    }

    private SolicitacaoLgpd inserir(AuthPrincipal auth, String tipo, String detalhe, String status) {
        return jdbc.query(
                """
                INSERT INTO flutz.solicitacao_titular
                    (empresa_id, titular_tipo, titular_id, tipo_solicitacao, status_solicitacao,
                     detalhamento, data_conclusao)
                VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'CONCLUIDA' THEN CURRENT_TIMESTAMP ELSE NULL END)
                RETURNING solicitacao_titular_id, empresa_id, titular_tipo, titular_id, tipo_solicitacao,
                          status_solicitacao, detalhamento, motivo_negativa, data_solicitacao,
                          data_conclusao, data_solicitacao + INTERVAL '15 days' AS prazo_limite
                """,
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível registrar a solicitação");
                    }
                    return mapSolicitacao(rs);
                },
                auth.tutor() ? null : auth.empresaId(), auth.tipo().name(), auth.atorId(), tipo, status, detalhe, status
        );
    }

    private SolicitacaoLgpd porId(Integer id) {
        SolicitacaoLgpd item = jdbc.query(
                """
                SELECT solicitacao_titular_id, empresa_id, titular_tipo, titular_id, tipo_solicitacao,
                       status_solicitacao, detalhamento, motivo_negativa, data_solicitacao,
                       data_conclusao, data_solicitacao + INTERVAL '15 days' AS prazo_limite
                FROM flutz.solicitacao_titular WHERE solicitacao_titular_id = ?
                """,
                rs -> rs.next() ? mapSolicitacao(rs) : null,
                id
        );
        if (item == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitação não encontrada");
        }
        return item;
    }

    private AuthPrincipal titularAtual() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor() && !auth.colaborador()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Entre com uma conta de tutor ou colaborador");
        }
        return auth;
    }

    private AuthPrincipal exigirAdmin() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da plataforma");
        }
        return auth;
    }

    private String normalizarTipo(String value) {
        String tipo = value == null ? "" : value.trim().toUpperCase();
        if (!TIPOS.contains(tipo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de solicitação inválido");
        }
        return tipo;
    }

    private static String limpar(String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String texto = value.trim();
        if (texto.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O detalhamento está longo demais");
        }
        return texto;
    }

    private static String codigoAnonimo(Integer id) {
        String codigo = "ANON" + id + Instant.now().toEpochMilli();
        return codigo.substring(0, Math.min(14, codigo.length()));
    }

    private void avisarAdministracao(SolicitacaoLgpd item, AuthPrincipal auth) {
        String destino = properties.admin() == null ? null : properties.admin().email();
        if (destino == null || destino.isBlank()) {
            log.warn("Solicitação LGPD #{} criada sem e-mail administrativo configurado", item.id());
            return;
        }
        try {
            email.send(
                    destino,
                    "Solicitação LGPD #" + item.id() + ": " + item.tipoSolicitacao(),
                    """
                    Uma nova solicitação LGPD requer análise.

                    Protocolo: #%s
                    Titular: %s (%s)
                    Tipo: %s
                    Prazo interno: %s
                    Detalhamento: %s
                    """.formatted(
                            item.id(), auth.nome(), item.titularTipo(), item.tipoSolicitacao(),
                            item.prazoLimite(), item.detalhamento() == null ? "—" : item.detalhamento()
                    )
            );
        } catch (RuntimeException ex) {
            log.error("Solicitação LGPD gravada, mas o aviso por e-mail falhou", ex);
        }
    }

    private void notificarCriacao(SolicitacaoLgpd item, AuthPrincipal auth) {
        try {
            notifications.notificarLgpdCriada(
                    item.id(),
                    item.empresaId(),
                    item.titularTipo(),
                    item.titularId(),
                    auth.nome(),
                    item.tipoSolicitacao(),
                    item.status()
            );
        } catch (RuntimeException ex) {
            log.warn("Solicitação LGPD #{} criada, mas a notificação in-app falhou", item.id(), ex);
        }
    }

    private void notificarStatus(SolicitacaoLgpd item) {
        try {
            notifications.notificarLgpdStatus(
                    item.id(),
                    item.empresaId(),
                    item.titularTipo(),
                    item.titularId(),
                    item.tipoSolicitacao(),
                    item.status(),
                    item.motivoNegativa()
            );
        } catch (RuntimeException ex) {
            log.warn("Solicitação LGPD #{} atualizada, mas a notificação in-app falhou", item.id(), ex);
        }
    }

    private static SolicitacaoLgpd mapSolicitacao(ResultSet rs) throws SQLException {
        return new SolicitacaoLgpd(
                rs.getInt("solicitacao_titular_id"),
                (Integer) rs.getObject("empresa_id"),
                rs.getString("titular_tipo"),
                rs.getInt("titular_id"),
                rs.getString("tipo_solicitacao"),
                rs.getString("status_solicitacao"),
                rs.getString("detalhamento"),
                rs.getString("motivo_negativa"),
                rs.getTimestamp("data_solicitacao").toInstant().toString(),
                rs.getTimestamp("data_conclusao") == null ? null : rs.getTimestamp("data_conclusao").toInstant().toString(),
                rs.getTimestamp("prazo_limite").toInstant().toString()
        );
    }

    public record NovaSolicitacao(String tipoSolicitacao, String detalhamento) {
    }

    public record AtualizacaoStatus(String status, String motivoNegativa) {
    }

    public record SolicitacaoLgpd(
            Integer id,
            Integer empresaId,
            String titularTipo,
            Integer titularId,
            String tipoSolicitacao,
            String status,
            String detalhamento,
            String motivoNegativa,
            String dataSolicitacao,
            String dataConclusao,
            String prazoLimite
    ) {
    }

    public record ResultadoSolicitacao(SolicitacaoLgpd solicitacao, PacotePortabilidade dados) {
    }

    public record PacotePortabilidade(
            String geradoEm,
            String titularTipo,
            Map<String, Object> perfil,
            List<Map<String, Object>> pets,
            List<Map<String, Object>> agendamentos,
            List<Map<String, Object>> vacinacoes,
            List<Map<String, Object>> chats,
            List<Map<String, Object>> papeis
    ) {
    }
}
