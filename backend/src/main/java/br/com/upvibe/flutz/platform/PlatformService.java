package br.com.upvibe.flutz.platform;

import java.math.BigDecimal;
import java.time.LocalDate;
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
public class PlatformService {

    private final JdbcTemplate jdbc;

    public PlatformService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public IndicadoresResponse indicadores(LocalDate de, LocalDate ate) {
        exigirAdmin();
        LocalDate inicio = de == null ? LocalDate.now().minusMonths(12) : de;
        LocalDate fim = ate == null ? LocalDate.now() : ate;

        BigDecimal mrr = nvl(jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(p.valor_mensal), 0)
                FROM flutz.assinatura a
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                WHERE a.status_assinatura IN ('ATIVA', 'TRIAL')
                """,
                BigDecimal.class
        ));
        long ativas = count("SELECT COUNT(*) FROM flutz.assinatura WHERE status_assinatura IN ('ATIVA', 'TRIAL')");
        long novas = count(
                "SELECT COUNT(*) FROM flutz.assinatura WHERE data_inicio BETWEEN ? AND ?",
                inicio, fim
        );
        long canceladas = count(
                "SELECT COUNT(*) FROM flutz.assinatura WHERE status_assinatura = 'CANCELADA' AND data_cancelamento::date BETWEEN ? AND ?",
                inicio, fim
        );
        BigDecimal faturamentoMes = nvl(jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(valor), 0)
                FROM flutz.fatura_assinatura
                WHERE status_fatura = 'PAGA'
                  AND data_pagamento IS NOT NULL
                  AND data_pagamento::date >= date_trunc('month', CURRENT_DATE)
                """,
                BigDecimal.class
        ));
        BigDecimal faturamentoPeriodo = nvl(jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(valor), 0)
                FROM flutz.fatura_assinatura
                WHERE status_fatura = 'PAGA'
                  AND data_pagamento::date BETWEEN ? AND ?
                """,
                BigDecimal.class,
                inicio, fim
        ));
        BigDecimal inadimplencia = nvl(jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(valor), 0)
                FROM flutz.fatura_assinatura
                WHERE status_fatura IN ('PENDENTE', 'ATRASADA')
                """,
                BigDecimal.class
        ));

        List<Ponto> receitaMensal = jdbc.query(
                """
                SELECT to_char(date_trunc('month', competencia), 'YYYY-MM') AS mes,
                       COALESCE(SUM(CASE WHEN status_fatura = 'PAGA' THEN valor ELSE 0 END), 0) AS valor
                FROM flutz.fatura_assinatura
                WHERE competencia BETWEEN ? AND ?
                GROUP BY 1
                ORDER BY 1
                """,
                (rs, i) -> new Ponto(rs.getString("mes"), rs.getBigDecimal("valor")),
                inicio.withDayOfMonth(1), fim
        );
        List<Ponto> assinaturasMes = jdbc.query(
                """
                SELECT to_char(date_trunc('month', data_inicio), 'YYYY-MM') AS mes, COUNT(*) AS valor
                FROM flutz.assinatura
                WHERE data_inicio BETWEEN ? AND ?
                GROUP BY 1
                ORDER BY 1
                """,
                (rs, i) -> new Ponto(rs.getString("mes"), BigDecimal.valueOf(rs.getLong("valor"))),
                inicio, fim
        );
        List<Ponto> porPlano = jdbc.query(
                """
                SELECT p.nome AS mes, COALESCE(SUM(p.valor_mensal), 0) AS valor
                FROM flutz.assinatura a
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                WHERE a.status_assinatura IN ('ATIVA', 'TRIAL')
                GROUP BY p.nome, p.valor_mensal
                ORDER BY p.nome
                """,
                (rs, i) -> new Ponto(rs.getString("mes"), rs.getBigDecimal("valor"))
        );
        List<Ponto> clinicasPorPlano = jdbc.query(
                """
                SELECT p.nome AS mes, COUNT(*) AS valor
                FROM flutz.assinatura a
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                WHERE a.status_assinatura IN ('ATIVA', 'TRIAL')
                GROUP BY p.nome
                ORDER BY p.nome
                """,
                (rs, i) -> new Ponto(rs.getString("mes"), BigDecimal.valueOf(rs.getLong("valor")))
        );
        List<Atividade> recentes = jdbc.query(
                """
                SELECT e.nome_empresa, a.status_assinatura, p.nome AS plano, a.data_inicio
                FROM flutz.assinatura a
                JOIN flutz.empresa e ON e.empresa_id = a.empresa_id
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                ORDER BY a.assinatura_id DESC
                LIMIT 8
                """,
                (rs, i) -> new Atividade(
                        rs.getString("nome_empresa"),
                        rs.getString("status_assinatura"),
                        rs.getString("plano"),
                        rs.getDate("data_inicio").toLocalDate().toString()
                )
        );

        return new IndicadoresResponse(
                mrr,
                mrr.multiply(BigDecimal.valueOf(12)),
                faturamentoMes,
                faturamentoPeriodo,
                inadimplencia,
                ativas,
                novas,
                canceladas,
                receitaMensal,
                assinaturasMes,
                porPlano,
                clinicasPorPlano,
                recentes
        );
    }

    public List<ClinicaAdmin> clinicas(String busca) {
        exigirAdmin();
        String termo = busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);
        return jdbc.query(
                """
                SELECT e.empresa_id, e.nome_empresa, e.cnpj, e.email, e.identificador_url, e.logo_url,
                       e.cidade, e.uf, s.descricao AS status, e.data_criacao,
                       p.nome AS plano, a.status_assinatura,
                       (SELECT COUNT(*) FROM flutz.colaborador c WHERE c.empresa_id = e.empresa_id) AS colaboradores,
                       (SELECT COUNT(*) FROM flutz.empresa_cliente ec WHERE ec.empresa_id = e.empresa_id) AS clientes,
                       (SELECT COUNT(DISTINCT pet_id) FROM (
                            SELECT pet_id FROM flutz.agendamento WHERE empresa_id = e.empresa_id
                            UNION
                            SELECT pet_id FROM flutz.atendimento WHERE empresa_id = e.empresa_id
                        ) pets_clinica) AS pets
                FROM flutz.empresa e
                JOIN flutz.status s ON s.status_id = e.status_id
                LEFT JOIN LATERAL (
                    SELECT * FROM flutz.assinatura x WHERE x.empresa_id = e.empresa_id ORDER BY x.assinatura_id DESC LIMIT 1
                ) a ON TRUE
                LEFT JOIN flutz.plano p ON p.plano_id = a.plano_id
                WHERE ? = ''
                   OR LOWER(e.nome_empresa) LIKE ?
                   OR e.cnpj LIKE ?
                   OR LOWER(e.identificador_url) LIKE ?
                ORDER BY e.empresa_id DESC
                """,
                (rs, i) -> new ClinicaAdmin(
                        rs.getInt("empresa_id"),
                        rs.getString("nome_empresa"),
                        rs.getString("cnpj"),
                        rs.getString("email"),
                        rs.getString("identificador_url"),
                        rs.getString("logo_url"),
                        rs.getString("cidade"),
                        rs.getString("uf"),
                        rs.getString("status"),
                        rs.getTimestamp("data_criacao") == null ? null : rs.getTimestamp("data_criacao").toInstant().toString(),
                        rs.getString("plano"),
                        rs.getString("status_assinatura"),
                        rs.getLong("colaboradores"),
                        rs.getLong("clientes"),
                        rs.getLong("pets")
                ),
                termo,
                "%" + termo + "%",
                "%" + termo + "%",
                "%" + termo + "%"
        );
    }

    public List<AssinaturaAdmin> assinaturas(String status) {
        exigirAdmin();
        String filtro = status == null || status.isBlank() ? null : status.toUpperCase(Locale.ROOT);
        return jdbc.query(
                """
                SELECT a.assinatura_id, e.nome_empresa, e.empresa_id, p.nome AS plano, p.valor_mensal,
                       a.status_assinatura, a.data_inicio, a.data_proximo_vencimento, a.data_cancelamento
                FROM flutz.assinatura a
                JOIN flutz.empresa e ON e.empresa_id = a.empresa_id
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                WHERE ? IS NULL OR a.status_assinatura = ?
                ORDER BY a.assinatura_id DESC
                """,
                (rs, i) -> new AssinaturaAdmin(
                        rs.getInt("assinatura_id"),
                        rs.getInt("empresa_id"),
                        rs.getString("nome_empresa"),
                        rs.getString("plano"),
                        rs.getBigDecimal("valor_mensal"),
                        rs.getString("status_assinatura"),
                        rs.getDate("data_inicio").toLocalDate().toString(),
                        rs.getDate("data_proximo_vencimento") == null ? null : rs.getDate("data_proximo_vencimento").toLocalDate().toString(),
                        rs.getTimestamp("data_cancelamento") == null ? null : rs.getTimestamp("data_cancelamento").toInstant().toString()
                ),
                filtro, filtro
        );
    }

    public List<FaturaAdmin> faturas() {
        exigirAdmin();
        return jdbc.query(
                """
                SELECT f.fatura_assinatura_id, e.nome_empresa, f.competencia, f.valor_bruto, f.valor,
                       f.moeda, f.status_fatura, f.data_vencimento, f.data_pagamento
                FROM flutz.fatura_assinatura f
                JOIN flutz.empresa e ON e.empresa_id = f.empresa_id
                ORDER BY f.competencia DESC, f.fatura_assinatura_id DESC
                """,
                (rs, i) -> new FaturaAdmin(
                        rs.getInt("fatura_assinatura_id"),
                        rs.getString("nome_empresa"),
                        rs.getDate("competencia").toLocalDate().toString(),
                        rs.getBigDecimal("valor_bruto"),
                        rs.getBigDecimal("valor"),
                        rs.getString("moeda"),
                        rs.getString("status_fatura"),
                        rs.getDate("data_vencimento").toLocalDate().toString(),
                        rs.getTimestamp("data_pagamento") == null ? null : rs.getTimestamp("data_pagamento").toInstant().toString()
                )
        );
    }

    public UsuariosAdmin usuarios() {
        exigirAdmin();
        List<Pessoa> admins = jdbc.query(
                """
                SELECT administrador_sistema_id AS id, nome, email, s.descricao AS status
                FROM flutz.administrador_sistema a
                JOIN flutz.status s ON s.status_id = a.status_id
                ORDER BY a.nome
                """,
                (rs, i) -> new Pessoa(rs.getInt("id"), rs.getString("nome"), rs.getString("email"), rs.getString("status"), null, null)
        );
        List<Pessoa> colaboradores = jdbc.query(
                """
                SELECT c.colaborador_id AS id, c.nome_colaborador AS nome, c.email, s.descricao AS status, e.nome_empresa, c.imagem_url
                FROM flutz.colaborador c
                JOIN flutz.status s ON s.status_id = c.status_id
                JOIN flutz.empresa e ON e.empresa_id = c.empresa_id
                ORDER BY c.nome_colaborador
                """,
                (rs, i) -> new Pessoa(
                        rs.getInt("id"),
                        rs.getString("nome"),
                        rs.getString("email"),
                        rs.getString("status"),
                        rs.getString("nome_empresa"),
                        rs.getString("imagem_url")
                )
        );
        List<Pessoa> clientes = jdbc.query(
                """
                SELECT c.cliente_id AS id, c.nome_cliente AS nome, COALESCE(c.email, c.cpf) AS email, s.descricao AS status, NULL, c.foto_url
                FROM flutz.cliente c
                JOIN flutz.status s ON s.status_id = c.status_id
                ORDER BY c.nome_cliente
                """,
                (rs, i) -> new Pessoa(
                        rs.getInt("id"),
                        rs.getString("nome"),
                        rs.getString("email"),
                        rs.getString("status"),
                        null,
                        rs.getString("foto_url")
                )
        );
        return new UsuariosAdmin(admins, colaboradores, clientes);
    }

    @Transactional
    public ClinicaAdmin atualizarStatusClinica(Integer id, String status) {
        exigirAdmin();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a clínica");
        }
        Integer statusId = statusId(status);
        int updated = jdbc.update(
                "UPDATE flutz.empresa SET status_id = ? WHERE empresa_id = ?",
                statusId, id
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Clínica não encontrada");
        }
        if ("inativo".equalsIgnoreCase(status)) {
            auditar("DESATIVAR", "EMPRESA", id, id);
        }
        return clinicas(null).stream()
                .filter(item -> id.equals(item.id()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Clínica não encontrada"));
    }

    @Transactional
    public Pessoa atualizarStatusUsuario(String tipo, Integer id, String status) {
        exigirAdmin();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o usuário");
        }
        String kind = tipo == null ? "" : tipo.trim().toLowerCase(Locale.ROOT);
        Integer statusId = statusId(status);
        if ("colaborador".equals(kind)) {
            int updated = jdbc.update(
                    "UPDATE flutz.colaborador SET status_id = ? WHERE colaborador_id = ?",
                    statusId, id
            );
            if (updated == 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Colaborador não encontrado");
            }
            if ("inativo".equalsIgnoreCase(status)) {
                Integer empresaId = jdbc.query(
                        "SELECT empresa_id FROM flutz.colaborador WHERE colaborador_id = ?",
                        rs -> rs.next() ? rs.getInt(1) : null,
                        id
                );
                auditar("DESATIVAR", "COLABORADOR", id, empresaId);
            }
            Pessoa pessoa = jdbc.query(
                    """
                    SELECT c.colaborador_id AS id, c.nome_colaborador AS nome, c.email, s.descricao AS status, e.nome_empresa, c.imagem_url
                    FROM flutz.colaborador c
                    JOIN flutz.status s ON s.status_id = c.status_id
                    JOIN flutz.empresa e ON e.empresa_id = c.empresa_id
                    WHERE c.colaborador_id = ?
                    """,
                    rs -> rs.next()
                            ? new Pessoa(
                            rs.getInt("id"),
                            rs.getString("nome"),
                            rs.getString("email"),
                            rs.getString("status"),
                            rs.getString("nome_empresa"),
                            rs.getString("imagem_url")
                    )
                            : null,
                    id
            );
            if (pessoa == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Colaborador não encontrado");
            }
            return pessoa;
        }
        if ("cliente".equals(kind)) {
            int updated = jdbc.update(
                    "UPDATE flutz.cliente SET status_id = ? WHERE cliente_id = ?",
                    statusId, id
            );
            if (updated == 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tutor não encontrado");
            }
            if ("inativo".equalsIgnoreCase(status)) {
                auditar("DESATIVAR", "CLIENTE", id, null);
            }
            Pessoa pessoa = jdbc.query(
                    """
                    SELECT c.cliente_id AS id, c.nome_cliente AS nome, COALESCE(c.email, c.cpf) AS email, s.descricao AS status, NULL, c.foto_url
                    FROM flutz.cliente c
                    JOIN flutz.status s ON s.status_id = c.status_id
                    WHERE c.cliente_id = ?
                    """,
                    rs -> rs.next()
                            ? new Pessoa(
                            rs.getInt("id"),
                            rs.getString("nome"),
                            rs.getString("email"),
                            rs.getString("status"),
                            null,
                            rs.getString("foto_url")
                    )
                            : null,
                    id
            );
            if (pessoa == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tutor não encontrado");
            }
            return pessoa;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo inválido. Use colaborador ou cliente.");
    }

    public List<AvaliacaoAdmin> avaliacoes() {
        exigirAdmin();
        return jdbc.query(
                """
                SELECT ac.avaliacao_cliente_id, e.nome_empresa, ac.nome_cliente, ac.nome_pet, ac.texto, ac.nota,
                       ac.visivel, ac.autorizado_publicacao, s.descricao AS status, ac.data_avaliacao
                FROM flutz.avaliacao_cliente ac
                JOIN flutz.empresa e ON e.empresa_id = ac.empresa_id
                JOIN flutz.status s ON s.status_id = ac.status_id
                ORDER BY ac.data_avaliacao DESC, ac.avaliacao_cliente_id DESC
                LIMIT 200
                """,
                (rs, i) -> new AvaliacaoAdmin(
                        rs.getInt("avaliacao_cliente_id"),
                        rs.getString("nome_empresa"),
                        rs.getString("nome_cliente"),
                        rs.getString("nome_pet"),
                        rs.getString("texto"),
                        rs.getBigDecimal("nota"),
                        rs.getBoolean("visivel"),
                        rs.getBoolean("autorizado_publicacao"),
                        rs.getString("status"),
                        rs.getTimestamp("data_avaliacao") == null
                                ? null
                                : rs.getTimestamp("data_avaliacao").toInstant().toString()
                )
        );
    }

    @Transactional
    public AvaliacaoAdmin atualizarVisibilidadeAvaliacao(Integer id, boolean visivel) {
        exigirAdmin();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a avaliação");
        }
        AvaliacaoAdmin atual = avaliacaoPorId(id);
        if (atual == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Avaliação não encontrada");
        }
        if (visivel && !atual.autorizado()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Só é possível publicar avaliações autorizadas pelo tutor");
        }
        jdbc.update(
                "UPDATE flutz.avaliacao_cliente SET visivel = ? WHERE avaliacao_cliente_id = ?",
                visivel, id
        );
        if (!visivel) {
            auditar("OCULTAR", "AVALIACAO_CLIENTE", id, empresaIdAvaliacao(id));
        }
        AvaliacaoAdmin next = avaliacaoPorId(id);
        if (next == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Avaliação não encontrada");
        }
        return next;
    }

    @Transactional
    public void excluirAvaliacao(Integer id) {
        exigirAdmin();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a avaliação");
        }
        Integer inativo = statusId("inativo");
        Integer empresaId = empresaIdAvaliacao(id);
        // Exclusão administrativa é sempre lógica para preservar histórico e rastreabilidade.
        int updated = jdbc.update(
                """
                UPDATE flutz.avaliacao_cliente
                SET status_id = ?, visivel = FALSE, autorizado_publicacao = FALSE
                WHERE avaliacao_cliente_id = ?
                """,
                inativo, id
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Avaliação não encontrada");
        }
        auditar("REMOVER", "AVALIACAO_CLIENTE", id, empresaId);
    }

    private Integer empresaIdAvaliacao(Integer id) {
        return jdbc.query(
                "SELECT empresa_id FROM flutz.avaliacao_cliente WHERE avaliacao_cliente_id = ?",
                rs -> rs.next() ? rs.getInt(1) : null,
                id
        );
    }

    private void auditar(String acao, String entidade, Integer entidadeId, Integer empresaId) {
        AuthPrincipal auth = AuthHolder.current();
        jdbc.update(
                """
                INSERT INTO flutz.auditoria_acao
                  (empresa_id, ator_tipo, ator_id, pagina, botao, detalhamento)
                VALUES (?, 'ADMINISTRADOR_SISTEMA', ?, '/admin', ?, ?)
                """,
                empresaId,
                auth.atorId(),
                acao,
                acao + " " + entidade + " #" + entidadeId
        );
    }

    private AvaliacaoAdmin avaliacaoPorId(Integer id) {
        return jdbc.query(
                """
                SELECT ac.avaliacao_cliente_id, e.nome_empresa, ac.nome_cliente, ac.nome_pet, ac.texto, ac.nota,
                       ac.visivel, ac.autorizado_publicacao, s.descricao AS status, ac.data_avaliacao
                FROM flutz.avaliacao_cliente ac
                JOIN flutz.empresa e ON e.empresa_id = ac.empresa_id
                JOIN flutz.status s ON s.status_id = ac.status_id
                WHERE ac.avaliacao_cliente_id = ?
                """,
                rs -> rs.next()
                        ? new AvaliacaoAdmin(
                        rs.getInt("avaliacao_cliente_id"),
                        rs.getString("nome_empresa"),
                        rs.getString("nome_cliente"),
                        rs.getString("nome_pet"),
                        rs.getString("texto"),
                        rs.getBigDecimal("nota"),
                        rs.getBoolean("visivel"),
                        rs.getBoolean("autorizado_publicacao"),
                        rs.getString("status"),
                        rs.getTimestamp("data_avaliacao") == null
                                ? null
                                : rs.getTimestamp("data_avaliacao").toInstant().toString()
                )
                        : null,
                id
        );
    }

    private Integer statusId(String status) {
        String value = status == null ? "" : status.trim().toLowerCase(Locale.ROOT);
        if (!"ativo".equals(value) && !"inativo".equals(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status inválido. Use ativo ou inativo.");
        }
        Integer id = jdbc.query(
                "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = ?",
                rs -> rs.next() ? rs.getInt(1) : null,
                value
        );
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status '" + value + "' ausente");
        }
        return id;
    }

    public List<Item> listarCatalogo(String tipo) {
        exigirAdmin();
        return switch (tipo) {
            case "especies" -> jdbc.query(
                    "SELECT pet_especie_id AS id, descricao AS nome FROM flutz.pet_especie ORDER BY descricao",
                    (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"))
            );
            case "racas" -> jdbc.query(
                    """
                    SELECT r.pet_raca_id AS id, e.descricao || ' · ' || r.descricao AS nome
                    FROM flutz.pet_raca r
                    JOIN flutz.pet_especie e ON e.pet_especie_id = r.pet_especie_id
                    ORDER BY e.descricao, r.descricao
                    """,
                    (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"))
            );
            case "vacinas" -> jdbc.query(
                    """
                    SELECT vacina_id AS id, nome_vacina AS nome
                    FROM flutz.vacina
                    WHERE empresa_id IS NULL
                    ORDER BY nome_vacina
                    """,
                    (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"))
            );
            case "doencas" -> jdbc.query(
                    "SELECT doenca_id AS id, nome_doenca AS nome FROM flutz.doenca ORDER BY nome_doenca",
                    (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"))
            );
            case "especialidades" -> jdbc.query(
                    "SELECT especialidade_id AS id, descricao AS nome FROM flutz.especialidade ORDER BY descricao",
                    (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"))
            );
            case "tipos-servico" -> jdbc.query(
                    "SELECT tipo_servico_id AS id, tipo_servico AS nome FROM flutz.tipo_servico ORDER BY tipo_servico",
                    (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"))
            );
            case "chat-motivos" -> jdbc.query(
                    "SELECT chat_motivo_id AS id, descricao AS nome FROM flutz.chat_motivo ORDER BY descricao",
                    (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"))
            );
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catálogo inválido");
        };
    }

    @Transactional
    public Item criarCatalogo(String tipo, String nome, Integer especieId) {
        exigirAdmin();
        if (nome == null || nome.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome");
        }
        String valor = nome.trim();
        Integer id = switch (tipo) {
            case "chat-motivos" -> {
                Integer status = jdbc.queryForObject(
                        "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = 'ativo'",
                        Integer.class
                );
                yield insertReturning(
                        "INSERT INTO flutz.chat_motivo (descricao, status_id) VALUES (?, ?) RETURNING chat_motivo_id",
                        valor, status
                );
            }
            case "vacinas" -> insertReturning(
                    """
                    INSERT INTO flutz.vacina (nome_vacina, descricao, fabricante, empresa_id)
                    VALUES (?, NULL, NULL, NULL)
                    RETURNING vacina_id
                    """,
                    valor
            );
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Espécies, raças, doenças, especialidades e tipos de serviço são cadastrados pela clínica. Vacinas e motivos de chat pela plataforma."
            );
        };
        return new Item(id, valor);
    }

    @Transactional
    public Item atualizarCatalogo(String tipo, Integer id, String nome) {
        exigirAdmin();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o item");
        }
        if (nome == null || nome.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome");
        }
        String valor = nome.trim();
        int updated = switch (tipo) {
            case "vacinas" -> jdbc.update(
                    "UPDATE flutz.vacina SET nome_vacina = ? WHERE vacina_id = ? AND empresa_id IS NULL",
                    valor, id
            );
            case "chat-motivos" -> jdbc.update(
                    "UPDATE flutz.chat_motivo SET descricao = ? WHERE chat_motivo_id = ?",
                    valor, id
            );
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catálogo não editável por este endpoint");
        };
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Item não encontrado");
        }
        return new Item(id, valor);
    }

    @Transactional
    public void removerCatalogo(String tipo, Integer id) {
        exigirAdmin();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o item");
        }
        try {
            int removed = switch (tipo) {
                case "vacinas" -> jdbc.update(
                        "DELETE FROM flutz.vacina WHERE vacina_id = ? AND empresa_id IS NULL",
                        id
                );
                case "chat-motivos" -> jdbc.update(
                        "DELETE FROM flutz.chat_motivo WHERE chat_motivo_id = ?",
                        id
                );
                default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catálogo não removível por este endpoint");
            };
            if (removed == 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Item não encontrado");
            }
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Este item está em uso (histórico, ofertas de clínicas etc.) e não pode ser removido."
            );
        }
    }

    public FaturamentoResumo faturamentoResumo() {
        exigirAdmin();
        BigDecimal pagoMes = nvl(jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(valor), 0)
                FROM flutz.fatura_assinatura
                WHERE status_fatura = 'PAGA'
                  AND data_pagamento IS NOT NULL
                  AND data_pagamento::date >= date_trunc('month', CURRENT_DATE)::date
                """,
                BigDecimal.class
        ));
        BigDecimal pendente = nvl(jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(valor), 0)
                FROM flutz.fatura_assinatura
                WHERE status_fatura = 'PENDENTE'
                  AND valor > 0
                  AND data_vencimento IS NOT NULL
                  AND data_vencimento::date >= CURRENT_DATE
                  AND data_vencimento::date <= (CURRENT_DATE + INTERVAL '5 days')
                """,
                BigDecimal.class
        ));
        BigDecimal atrasado = nvl(jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(valor), 0)
                FROM flutz.fatura_assinatura
                WHERE status_fatura = 'ATRASADA'
                   OR (
                     status_fatura = 'PENDENTE'
                     AND valor > 0
                     AND data_vencimento IS NOT NULL
                     AND data_vencimento::date < CURRENT_DATE
                   )
                """,
                BigDecimal.class
        ));
        long qtdPago = count(
                """
                SELECT COUNT(DISTINCT empresa_id)
                FROM flutz.fatura_assinatura
                WHERE status_fatura = 'PAGA'
                  AND data_pagamento IS NOT NULL
                  AND data_pagamento::date >= date_trunc('month', CURRENT_DATE)::date
                """
        );
        long qtdPendente = count(
                """
                SELECT COUNT(DISTINCT empresa_id)
                FROM flutz.fatura_assinatura
                WHERE status_fatura = 'PENDENTE'
                  AND valor > 0
                  AND data_vencimento IS NOT NULL
                  AND data_vencimento::date >= CURRENT_DATE
                  AND data_vencimento::date <= (CURRENT_DATE + INTERVAL '5 days')
                """
        );
        long qtdAtrasado = count(
                """
                SELECT COUNT(DISTINCT empresa_id)
                FROM flutz.fatura_assinatura
                WHERE status_fatura = 'ATRASADA'
                   OR (
                     status_fatura = 'PENDENTE'
                     AND valor > 0
                     AND data_vencimento IS NOT NULL
                     AND data_vencimento::date < CURRENT_DATE
                   )
                """
        );
        return new FaturamentoResumo(pagoMes, pendente, atrasado, qtdPago, qtdPendente, qtdAtrasado);
    }

    public List<FaturamentoEmpresaCard> faturamentoEmpresasPorStatus(String statusFatura) {
        exigirAdmin();
        String status = statusFatura == null ? "" : statusFatura.trim().toUpperCase(Locale.ROOT);
        if (!List.of("PAGA", "PENDENTE", "ATRASADA").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status inválido");
        }
        if ("PAGA".equals(status)) {
            return jdbc.query(
                    """
                    SELECT e.empresa_id, e.nome_empresa, e.telefone, e.email, e.logo_url,
                           a.status_assinatura,
                           COALESCE(SUM(f.valor), 0) AS total
                    FROM flutz.empresa e
                    JOIN flutz.fatura_assinatura f ON f.empresa_id = e.empresa_id
                    LEFT JOIN LATERAL (
                        SELECT status_assinatura FROM flutz.assinatura x
                        WHERE x.empresa_id = e.empresa_id
                        ORDER BY x.assinatura_id DESC LIMIT 1
                    ) a ON TRUE
                    WHERE f.status_fatura = 'PAGA'
                      AND f.data_pagamento IS NOT NULL
                      AND f.data_pagamento::date >= date_trunc('month', CURRENT_DATE)::date
                    GROUP BY e.empresa_id, e.nome_empresa, e.telefone, e.email, e.logo_url, a.status_assinatura
                    ORDER BY e.nome_empresa
                    """,
                    (rs, i) -> new FaturamentoEmpresaCard(
                            rs.getInt("empresa_id"),
                            rs.getString("nome_empresa"),
                            rs.getString("telefone"),
                            rs.getString("email"),
                            rs.getString("logo_url"),
                            rs.getString("status_assinatura"),
                            rs.getBigDecimal("total")
                    )
            );
        }
        if ("PENDENTE".equals(status)) {
            return jdbc.query(
                    """
                    SELECT e.empresa_id, e.nome_empresa, e.telefone, e.email, e.logo_url,
                           a.status_assinatura,
                           COALESCE(SUM(f.valor), 0) AS total
                    FROM flutz.empresa e
                    JOIN flutz.fatura_assinatura f ON f.empresa_id = e.empresa_id
                    LEFT JOIN LATERAL (
                        SELECT status_assinatura FROM flutz.assinatura x
                        WHERE x.empresa_id = e.empresa_id
                        ORDER BY x.assinatura_id DESC LIMIT 1
                    ) a ON TRUE
                    WHERE f.status_fatura = 'PENDENTE'
                      AND f.valor > 0
                      AND f.data_vencimento IS NOT NULL
                      AND f.data_vencimento::date >= CURRENT_DATE
                      AND f.data_vencimento::date <= (CURRENT_DATE + INTERVAL '5 days')
                    GROUP BY e.empresa_id, e.nome_empresa, e.telefone, e.email, e.logo_url, a.status_assinatura
                    ORDER BY e.nome_empresa
                    """,
                    (rs, i) -> new FaturamentoEmpresaCard(
                            rs.getInt("empresa_id"),
                            rs.getString("nome_empresa"),
                            rs.getString("telefone"),
                            rs.getString("email"),
                            rs.getString("logo_url"),
                            rs.getString("status_assinatura"),
                            rs.getBigDecimal("total")
                    )
            );
        }
        // ATRASADA: inclui faturas atrasadas e pendentes já vencidas
        return jdbc.query(
                """
                SELECT e.empresa_id, e.nome_empresa, e.telefone, e.email, e.logo_url,
                       a.status_assinatura,
                       COALESCE(SUM(f.valor), 0) AS total
                FROM flutz.empresa e
                JOIN flutz.fatura_assinatura f ON f.empresa_id = e.empresa_id
                LEFT JOIN LATERAL (
                    SELECT status_assinatura FROM flutz.assinatura x
                    WHERE x.empresa_id = e.empresa_id
                    ORDER BY x.assinatura_id DESC LIMIT 1
                ) a ON TRUE
                WHERE f.valor > 0
                  AND (
                    f.status_fatura = 'ATRASADA'
                    OR (
                      f.status_fatura = 'PENDENTE'
                      AND f.data_vencimento IS NOT NULL
                      AND f.data_vencimento::date < CURRENT_DATE
                    )
                  )
                GROUP BY e.empresa_id, e.nome_empresa, e.telefone, e.email, e.logo_url, a.status_assinatura
                ORDER BY e.nome_empresa
                """,
                (rs, i) -> new FaturamentoEmpresaCard(
                        rs.getInt("empresa_id"),
                        rs.getString("nome_empresa"),
                        rs.getString("telefone"),
                        rs.getString("email"),
                        rs.getString("logo_url"),
                        rs.getString("status_assinatura"),
                        rs.getBigDecimal("total")
                )
        );
    }

    @Transactional
    public FaturamentoEmpresaCard marcarPagamentoManual(Integer empresaId) {
        exigirAdmin();
        if (empresaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a empresa");
        }
        int updated = jdbc.update(
                """
                UPDATE flutz.fatura_assinatura
                SET status_fatura = 'PAGA',
                    data_pagamento = COALESCE(data_pagamento, CURRENT_TIMESTAMP),
                    provider = COALESCE(provider, 'manual'),
                    ultima_atualizacao = CURRENT_TIMESTAMP
                WHERE empresa_id = ?
                  AND status_fatura IN ('PENDENTE', 'ATRASADA')
                """,
                empresaId
        );
        if (updated == 0) {
            // ainda assim pode reativar assinatura se já estiver paga
            Integer exists = jdbc.query(
                    "SELECT 1 FROM flutz.empresa WHERE empresa_id = ?",
                    rs -> rs.next() ? 1 : null,
                    empresaId
            );
            if (exists == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa não encontrada");
            }
        }
        jdbc.update(
                """
                UPDATE flutz.assinatura
                SET status_assinatura = 'ATIVA',
                    ultima_atualizacao = CURRENT_TIMESTAMP
                WHERE empresa_id = ?
                  AND status_assinatura IN ('INADIMPLENTE', 'SUSPENSA', 'TRIAL', 'ATIVA')
                """,
                empresaId
        );
        auditar("PAGAMENTO_MANUAL", "EMPRESA", empresaId, empresaId);
        return faturamentoEmpresasPorStatus("PAGA").stream()
                .filter(e -> empresaId.equals(e.empresaId()))
                .findFirst()
                .orElseGet(() -> jdbc.query(
                        """
                        SELECT e.empresa_id, e.nome_empresa, e.telefone, e.email, e.logo_url, a.status_assinatura, 0 AS total
                        FROM flutz.empresa e
                        LEFT JOIN LATERAL (
                            SELECT status_assinatura FROM flutz.assinatura x
                            WHERE x.empresa_id = e.empresa_id ORDER BY x.assinatura_id DESC LIMIT 1
                        ) a ON TRUE
                        WHERE e.empresa_id = ?
                        """,
                        (rs, i) -> new FaturamentoEmpresaCard(
                                rs.getInt("empresa_id"),
                                rs.getString("nome_empresa"),
                                rs.getString("telefone"),
                                rs.getString("email"),
                                rs.getString("logo_url"),
                                rs.getString("status_assinatura"),
                                BigDecimal.ZERO
                        ),
                        empresaId
                ).stream().findFirst().orElseThrow());
    }

    public List<Ponto> topEmpresasVinculo() {
        exigirAdmin();
        return jdbc.query(
                """
                SELECT e.nome_empresa AS rotulo,
                       (CURRENT_DATE - a.data_inicio) AS valor
                FROM flutz.assinatura a
                JOIN flutz.empresa e ON e.empresa_id = a.empresa_id
                WHERE a.status_assinatura = 'ATIVA'
                  AND a.assinatura_id = (
                    SELECT MAX(x.assinatura_id) FROM flutz.assinatura x WHERE x.empresa_id = a.empresa_id
                  )
                ORDER BY a.data_inicio ASC
                LIMIT 10
                """,
                (rs, i) -> new Ponto(rs.getString("rotulo"), BigDecimal.valueOf(rs.getLong("valor")))
        );
    }

    public List<Ponto> topEmpresasRendimento() {
        exigirAdmin();
        return jdbc.query(
                """
                SELECT e.nome_empresa AS rotulo, COALESCE(SUM(p.valor), 0) AS valor
                FROM flutz.pagamento p
                JOIN flutz.empresa e ON e.empresa_id = p.empresa_id
                WHERE p.status_pagamento = 'PAGO'
                GROUP BY e.empresa_id, e.nome_empresa
                ORDER BY valor DESC
                LIMIT 10
                """,
                (rs, i) -> new Ponto(rs.getString("rotulo"), rs.getBigDecimal("valor"))
        );
    }

    public PaginaFaturamentoEmpresas faturamentoEmpresasPage(String busca, int page, int size) {
        exigirAdmin();
        int safeSize = Math.min(Math.max(size, 1), 15);
        int safePage = Math.max(page, 0);
        int offset = safePage * safeSize;
        String termo = busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);
        long total = nvlLong(jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM flutz.empresa e
                WHERE ? = '' OR LOWER(e.nome_empresa) LIKE ?
                """,
                Long.class,
                termo, "%" + termo + "%"
        ));
        List<FaturamentoEmpresaLinha> items = jdbc.query(
                """
                SELECT e.empresa_id, e.nome_empresa, e.email, e.telefone, e.logo_url,
                       a.status_assinatura,
                       COALESCE((
                         SELECT SUM(p.valor) FROM flutz.pagamento p
                         WHERE p.empresa_id = e.empresa_id
                           AND p.status_pagamento = 'PAGO'
                           AND p.pago_em::date >= date_trunc('month', CURRENT_DATE)::date
                       ), 0) AS lucro_mes,
                       COALESCE((
                         SELECT SUM(p.valor) FROM flutz.pagamento p
                         WHERE p.empresa_id = e.empresa_id
                           AND p.status_pagamento = 'PAGO'
                           AND p.pago_em::date >= date_trunc('year', CURRENT_DATE)::date
                       ), 0) AS lucro_ano
                FROM flutz.empresa e
                LEFT JOIN LATERAL (
                    SELECT status_assinatura FROM flutz.assinatura x
                    WHERE x.empresa_id = e.empresa_id
                    ORDER BY x.assinatura_id DESC LIMIT 1
                ) a ON TRUE
                WHERE ? = '' OR LOWER(e.nome_empresa) LIKE ?
                ORDER BY e.nome_empresa
                LIMIT ? OFFSET ?
                """,
                (rs, i) -> new FaturamentoEmpresaLinha(
                        rs.getInt("empresa_id"),
                        rs.getString("nome_empresa"),
                        rs.getString("email"),
                        rs.getString("telefone"),
                        rs.getString("logo_url"),
                        rs.getString("status_assinatura"),
                        rs.getBigDecimal("lucro_mes"),
                        rs.getBigDecimal("lucro_ano")
                ),
                termo, "%" + termo + "%", safeSize, offset
        );
        return new PaginaFaturamentoEmpresas(items, total, safePage, safeSize);
    }

    public List<FaturamentoMovimento> faturamentoEmpresaDetalhes(Integer empresaId) {
        exigirAdmin();
        if (empresaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a empresa");
        }
        return jdbc.query(
                """
                SELECT p.pagamento_id,
                       p.tipo_origem,
                       CASE
                         WHEN a.tipo = 'VACINACAO' OR a.empresa_vacina_id IS NOT NULL THEN 'VACINACAO'
                         WHEN p.tipo_origem = 'ATENDIMENTO' OR a.tipo = 'ATENDIMENTO' THEN 'ATENDIMENTO'
                         ELSE COALESCE(p.tipo_origem, 'OUTRO')
                       END AS categoria,
                       COALESCE(
                         v.nome_vacina,
                         NULLIF(es.nome_exibicao, ''),
                         ts.tipo_servico,
                         p.descricao,
                         'Pagamento'
                       ) AS descricao,
                       pet.nome_pet,
                       c.nome_cliente,
                       p.valor,
                       p.pago_em,
                       p.status_pagamento
                FROM flutz.pagamento p
                LEFT JOIN flutz.agendamento a ON a.agendamento_id = p.agendamento_id
                LEFT JOIN flutz.empresa_servico es ON es.empresa_servico_id = COALESCE(p.empresa_servico_id, a.empresa_servico_id)
                LEFT JOIN flutz.tipo_servico ts ON ts.tipo_servico_id = es.tipo_servico_id
                LEFT JOIN flutz.empresa_vacina ev ON ev.empresa_vacina_id = a.empresa_vacina_id
                LEFT JOIN flutz.vacina v ON v.vacina_id = ev.vacina_id
                LEFT JOIN flutz.pet pet ON pet.pet_id = a.pet_id
                LEFT JOIN flutz.cliente c ON c.cliente_id = COALESCE(p.cliente_id, a.cliente_id)
                WHERE p.empresa_id = ?
                  AND p.status_pagamento = 'PAGO'
                ORDER BY p.pago_em DESC NULLS LAST, p.pagamento_id DESC
                LIMIT 200
                """,
                (rs, i) -> new FaturamentoMovimento(
                        rs.getInt("pagamento_id"),
                        rs.getString("categoria"),
                        rs.getString("descricao"),
                        rs.getString("nome_pet"),
                        rs.getString("nome_cliente"),
                        rs.getBigDecimal("valor"),
                        rs.getTimestamp("pago_em") == null ? null : rs.getTimestamp("pago_em").toInstant().toString(),
                        rs.getString("status_pagamento")
                ),
                empresaId
        );
    }

    private Integer insertReturning(String sql, Object... args) {
        try {
            return jdbc.queryForObject(sql, Integer.class, args);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um registro com esse nome");
        }
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private static long nvlLong(Long value) {
        return value == null ? 0L : value;
    }

    private static BigDecimal nvl(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private void exigirAdmin() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da plataforma");
        }
    }

    public record IndicadoresResponse(
            BigDecimal mrr,
            BigDecimal arr,
            BigDecimal faturamentoMes,
            BigDecimal faturamentoPeriodo,
            BigDecimal inadimplencia,
            long assinaturasAtivas,
            long novasAssinaturas,
            long cancelamentos,
            List<Ponto> receitaMensal,
            List<Ponto> assinaturasMes,
            List<Ponto> receitaPorPlano,
            List<Ponto> clinicasPorPlano,
            List<Atividade> atividade
    ) {
    }

    public record Ponto(String rotulo, BigDecimal valor) {
    }

    public record Atividade(String clinica, String status, String plano, String quando) {
    }

    public record ClinicaAdmin(
            Integer id,
            String nome,
            String cnpj,
            String email,
            String slug,
            String logoUrl,
            String cidade,
            String uf,
            String status,
            String criadoEm,
            String plano,
            String statusAssinatura,
            long colaboradores,
            long clientes,
            long pets
    ) {
    }

    public record AssinaturaAdmin(
            Integer id,
            Integer empresaId,
            String clinica,
            String plano,
            BigDecimal valorMensal,
            String status,
            String inicio,
            String proximoVencimento,
            String cancelamento
    ) {
    }

    public record FaturaAdmin(
            Integer id,
            String clinica,
            String competencia,
            BigDecimal valorBruto,
            BigDecimal valor,
            String moeda,
            String status,
            String vencimento,
            String pagamento
    ) {
    }

    public record UsuariosAdmin(List<Pessoa> administradores, List<Pessoa> colaboradores, List<Pessoa> clientes) {
    }

    public record Pessoa(Integer id, String nome, String identificador, String status, String clinica, String fotoUrl) {
    }

    public record AvaliacaoAdmin(
            Integer id,
            String clinica,
            String tutor,
            String pet,
            String texto,
            BigDecimal nota,
            boolean visivel,
            boolean autorizado,
            String status,
            String data
    ) {
    }

    public record Item(Integer id, String nome) {
    }

    public record FaturamentoResumo(
            BigDecimal pagoMes,
            BigDecimal pendente,
            BigDecimal atrasado,
            long empresasPagoMes,
            long empresasPendente,
            long empresasAtrasado
    ) {
    }

    public record FaturamentoEmpresaCard(
            Integer empresaId,
            String nome,
            String telefone,
            String email,
            String logoUrl,
            String statusAssinatura,
            BigDecimal total
    ) {
    }

    public record FaturamentoEmpresaLinha(
            Integer empresaId,
            String nome,
            String email,
            String telefone,
            String logoUrl,
            String statusAssinatura,
            BigDecimal lucroMes,
            BigDecimal lucroAno
    ) {
    }

    public record PaginaFaturamentoEmpresas(
            List<FaturamentoEmpresaLinha> items,
            long total,
            int page,
            int size
    ) {
    }

    public record FaturamentoMovimento(
            Integer id,
            String categoria,
            String descricao,
            String pet,
            String tutor,
            BigDecimal valor,
            String pagoEm,
            String status
    ) {
    }

}
