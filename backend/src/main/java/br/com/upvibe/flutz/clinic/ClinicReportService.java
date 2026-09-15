package br.com.upvibe.flutz.clinic;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.domain.Empresa;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class ClinicReportService {

    private static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;

    public ClinicReportService(JdbcTemplate jdbc, ClinicService clinic) {
        this.jdbc = jdbc;
        this.clinic = clinic;
    }

    public VisaoGeral visaoGeral(
            LocalDate de,
            LocalDate ate,
            Integer profissionalId,
            Integer servicoId,
            String statusCodigo
    ) {
        exigirAdminClinica();
        Empresa empresa = clinic.empresaAtual();
        Integer empresaId = empresa.getId();
        Periodo periodo = resolverPeriodo(de, ate);
        Periodo anterior = periodoAnterior(periodo);

        Kpis atuais = kpis(empresaId, periodo, profissionalId, servicoId, statusCodigo);
        Kpis prev = kpis(empresaId, anterior, profissionalId, servicoId, statusCodigo);

        return new VisaoGeral(
                empresa.getNomeEmpresa(),
                periodo.de().toString(),
                periodo.ate().toString(),
                anterior.de().toString(),
                anterior.ate().toString(),
                atuais,
                prev,
                deltas(atuais, prev),
                serieFaturamento(empresaId, periodo, profissionalId, servicoId),
                serieAtendimentos(empresaId, periodo, profissionalId, servicoId, statusCodigo),
                agendamentosPorStatus(empresaId, periodo, profissionalId, servicoId),
                servicosMaisRealizados(empresaId, periodo, profissionalId, statusCodigo),
                servicosMaisReceita(empresaId, periodo, profissionalId),
                ocupacaoPorDia(empresaId, periodo, profissionalId)
        );
    }

    private Kpis kpis(Integer empresaId, Periodo p, Integer profissionalId, Integer servicoId, String status) {
        BigDecimal faturamento = sumFaturamento(empresaId, p, profissionalId, servicoId);
        long atendimentos = countAgendamentos(empresaId, p, profissionalId, servicoId, status, false);
        long cancelamentos = countAgendamentos(empresaId, p, profissionalId, servicoId, null, true);
        long faltas = countCodigo(empresaId, p, profissionalId, servicoId, "FALTOU");
        long novosTutores = countNovosTutores(empresaId, p);
        long novosPets = countNovosPets(empresaId, p);
        long retornos = countRetornos(empresaId, p, profissionalId, servicoId);
        BigDecimal ticket = atendimentos > 0
                ? faturamento.divide(BigDecimal.valueOf(atendimentos), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal ocupacao = ocupacaoPercentual(empresaId, p, profissionalId);
        return new Kpis(
                faturamento,
                atendimentos,
                novosTutores,
                novosPets,
                cancelamentos,
                faltas,
                retornos,
                ticket,
                ocupacao
        );
    }

    private BigDecimal sumFaturamento(Integer empresaId, Periodo p, Integer profissionalId, Integer servicoId) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT COALESCE(SUM(pg.valor), 0)
                FROM flutz.pagamento pg
                LEFT JOIN flutz.agendamento g ON g.agendamento_id = pg.agendamento_id
                WHERE pg.empresa_id = ?
                  AND pg.status_pagamento = 'PAGO'
                  AND COALESCE(pg.pago_em, pg.data_criacao) >= ?
                  AND COALESCE(pg.pago_em, pg.data_criacao) < ?
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        if (servicoId != null) {
            sql.append(" AND COALESCE(pg.empresa_servico_id, g.empresa_servico_id) = ? ");
            args.add(servicoId);
        }
        BigDecimal pago = jdbc.queryForObject(sql.toString(), BigDecimal.class, args.toArray());
        if (pago != null && pago.compareTo(BigDecimal.ZERO) > 0) {
            return pago.setScale(2, RoundingMode.HALF_UP);
        }
        // Fallback: snapshot nos agendamentos confirmados/concluídos
        StringBuilder fb = new StringBuilder(
                """
                SELECT COALESCE(SUM(COALESCE(g.valor_cobrado, g.valor_servico, 0)), 0)
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                  AND st.codigo IN ('CONFIRMADO', 'CONCLUIDO', 'AGUARDANDO_PAGAMENTO')
                """
        );
        List<Object> fbArgs = new ArrayList<>();
        fbArgs.add(empresaId);
        fbArgs.add(Timestamp.valueOf(p.de().atStartOfDay()));
        fbArgs.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        if (profissionalId != null) {
            fb.append(" AND g.colaborador_id = ? ");
            fbArgs.add(profissionalId);
        }
        if (servicoId != null) {
            fb.append(" AND g.empresa_servico_id = ? ");
            fbArgs.add(servicoId);
        }
        BigDecimal snap = jdbc.queryForObject(fb.toString(), BigDecimal.class, fbArgs.toArray());
        return (snap == null ? BigDecimal.ZERO : snap).setScale(2, RoundingMode.HALF_UP);
    }

    private long countAgendamentos(
            Integer empresaId, Periodo p, Integer profissionalId, Integer servicoId, String status, boolean soCancelados
    ) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT COUNT(*)
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        if (soCancelados) {
            sql.append(" AND st.codigo IN ('CANCELADO', 'CANCELADO_CLIENTE', 'CANCELADO_CLINICA', 'RECUSADO') ");
        } else if (status != null && !status.isBlank()) {
            sql.append(" AND st.codigo = ? ");
            args.add(status.toUpperCase(Locale.ROOT));
        } else {
            sql.append(" AND st.codigo NOT IN ('CANCELADO', 'CANCELADO_CLIENTE', 'CANCELADO_CLINICA', 'RECUSADO') ");
        }
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        if (servicoId != null) {
            sql.append(" AND g.empresa_servico_id = ? ");
            args.add(servicoId);
        }
        Long n = jdbc.queryForObject(sql.toString(), Long.class, args.toArray());
        return n == null ? 0 : n;
    }

    private long countCodigo(Integer empresaId, Periodo p, Integer profissionalId, Integer servicoId, String codigo) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT COUNT(*)
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                  AND st.codigo = ?
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        args.add(codigo);
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        if (servicoId != null) {
            sql.append(" AND g.empresa_servico_id = ? ");
            args.add(servicoId);
        }
        Long n = jdbc.queryForObject(sql.toString(), Long.class, args.toArray());
        return n == null ? 0 : n;
    }

    private long countNovosTutores(Integer empresaId, Periodo p) {
        Long n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM flutz.empresa_cliente
                WHERE empresa_id = ?
                  AND data_criacao >= ? AND data_criacao < ?
                """,
                Long.class,
                empresaId,
                Timestamp.valueOf(p.de().atStartOfDay()),
                Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay())
        );
        return n == null ? 0 : n;
    }

    private long countNovosPets(Integer empresaId, Periodo p) {
        Long n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM flutz.pet p
                WHERE p.data_criacao >= ? AND p.data_criacao < ?
                  AND (
                    p.empresa_id = ?
                    OR p.pet_id IN (
                      SELECT pet_id FROM flutz.agendamento WHERE empresa_id = ?
                      UNION
                      SELECT pet_id FROM flutz.atendimento WHERE empresa_id = ?
                    )
                    OR p.cliente_id IN (
                      SELECT cliente_id FROM flutz.empresa_cliente WHERE empresa_id = ?
                    )
                  )
                """,
                Long.class,
                Timestamp.valueOf(p.de().atStartOfDay()),
                Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()),
                empresaId, empresaId, empresaId, empresaId
        );
        return n == null ? 0 : n;
    }

    private long countRetornos(Integer empresaId, Periodo p, Integer profissionalId, Integer servicoId) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT COUNT(DISTINCT g.cliente_id)
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                  AND st.codigo NOT IN ('CANCELADO', 'CANCELADO_CLIENTE', 'CANCELADO_CLINICA', 'RECUSADO')
                  AND EXISTS (
                    SELECT 1 FROM flutz.agendamento g2
                    JOIN flutz.agendamento_status st2 ON st2.agendamento_status_id = g2.agendamento_status_id
                    WHERE g2.empresa_id = g.empresa_id
                      AND g2.cliente_id = g.cliente_id
                      AND g2.data_hora_inicio < ?
                      AND st2.codigo NOT IN ('CANCELADO', 'CANCELADO_CLIENTE', 'CANCELADO_CLINICA', 'RECUSADO')
                  )
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        if (servicoId != null) {
            sql.append(" AND g.empresa_servico_id = ? ");
            args.add(servicoId);
        }
        Long n = jdbc.queryForObject(sql.toString(), Long.class, args.toArray());
        return n == null ? 0 : n;
    }

    private BigDecimal ocupacaoPercentual(Integer empresaId, Periodo p, Integer profissionalId) {
        long dias = Math.max(1, ChronoUnit.DAYS.between(p.de(), p.ate()) + 1);
        // Capacidade aproximada: 16 slots de 30 min por dia útil (8h)
        long capacidade = dias * 16;
        long ocupados = countAgendamentos(empresaId, p, profissionalId, null, null, false);
        if (capacidade <= 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(ocupados * 100.0 / capacidade).setScale(1, RoundingMode.HALF_UP);
    }

    private List<Ponto> serieFaturamento(Integer empresaId, Periodo p, Integer profissionalId, Integer servicoId) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT TO_CHAR(COALESCE(pg.pago_em, pg.data_criacao), 'YYYY-MM-DD') AS rotulo,
                       COALESCE(SUM(pg.valor), 0) AS valor
                FROM flutz.pagamento pg
                LEFT JOIN flutz.agendamento g ON g.agendamento_id = pg.agendamento_id
                WHERE pg.empresa_id = ?
                  AND pg.status_pagamento = 'PAGO'
                  AND COALESCE(pg.pago_em, pg.data_criacao) >= ?
                  AND COALESCE(pg.pago_em, pg.data_criacao) < ?
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        if (servicoId != null) {
            sql.append(" AND COALESCE(pg.empresa_servico_id, g.empresa_servico_id) = ? ");
            args.add(servicoId);
        }
        sql.append(" GROUP BY 1 ORDER BY 1 ");
        List<Ponto> pontos = jdbc.query(
                sql.toString(),
                (rs, i) -> new Ponto(rs.getString("rotulo"), rs.getBigDecimal("valor")),
                args.toArray()
        );
        if (!pontos.isEmpty()) {
            return pontos;
        }
        return jdbc.query(
                """
                SELECT TO_CHAR(g.data_hora_inicio, 'YYYY-MM-DD') AS rotulo,
                       COALESCE(SUM(COALESCE(g.valor_cobrado, g.valor_servico, 0)), 0) AS valor
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                  AND st.codigo IN ('CONFIRMADO', 'CONCLUIDO', 'AGUARDANDO_PAGAMENTO')
                GROUP BY 1 ORDER BY 1
                """,
                (rs, i) -> new Ponto(rs.getString("rotulo"), rs.getBigDecimal("valor")),
                empresaId,
                Timestamp.valueOf(p.de().atStartOfDay()),
                Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay())
        );
    }

    private List<Ponto> serieAtendimentos(
            Integer empresaId, Periodo p, Integer profissionalId, Integer servicoId, String status
    ) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT TO_CHAR(g.data_hora_inicio, 'YYYY-MM-DD') AS rotulo, COUNT(*) AS valor
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        if (status != null && !status.isBlank()) {
            sql.append(" AND st.codigo = ? ");
            args.add(status.toUpperCase(Locale.ROOT));
        } else {
            sql.append(" AND st.codigo NOT IN ('CANCELADO', 'CANCELADO_CLIENTE', 'CANCELADO_CLINICA', 'RECUSADO') ");
        }
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        if (servicoId != null) {
            sql.append(" AND g.empresa_servico_id = ? ");
            args.add(servicoId);
        }
        sql.append(" GROUP BY 1 ORDER BY 1 ");
        return jdbc.query(
                sql.toString(),
                (rs, i) -> new Ponto(rs.getString("rotulo"), BigDecimal.valueOf(rs.getLong("valor"))),
                args.toArray()
        );
    }

    private List<Ponto> agendamentosPorStatus(Integer empresaId, Periodo p, Integer profissionalId, Integer servicoId) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT st.codigo AS rotulo, COUNT(*) AS valor
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        if (servicoId != null) {
            sql.append(" AND g.empresa_servico_id = ? ");
            args.add(servicoId);
        }
        sql.append(" GROUP BY st.codigo ORDER BY valor DESC ");
        return jdbc.query(
                sql.toString(),
                (rs, i) -> new Ponto(rs.getString("rotulo"), BigDecimal.valueOf(rs.getLong("valor"))),
                args.toArray()
        );
    }

    private List<Ponto> servicosMaisRealizados(Integer empresaId, Periodo p, Integer profissionalId, String status) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT COALESCE(es.nome_exibicao, ts.tipo_servico, v.nome_vacina, 'Sem serviço') AS rotulo,
                       COUNT(*) AS valor
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                LEFT JOIN flutz.empresa_servico es ON es.empresa_servico_id = g.empresa_servico_id
                LEFT JOIN flutz.tipo_servico ts ON ts.tipo_servico_id = es.tipo_servico_id
                LEFT JOIN flutz.empresa_vacina ev ON ev.empresa_vacina_id = g.empresa_vacina_id
                LEFT JOIN flutz.vacina v ON v.vacina_id = ev.vacina_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        if (status != null && !status.isBlank()) {
            sql.append(" AND st.codigo = ? ");
            args.add(status.toUpperCase(Locale.ROOT));
        } else {
            sql.append(" AND st.codigo NOT IN ('CANCELADO', 'CANCELADO_CLIENTE', 'CANCELADO_CLINICA', 'RECUSADO') ");
        }
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        sql.append(" GROUP BY 1 ORDER BY valor DESC LIMIT 10 ");
        return jdbc.query(
                sql.toString(),
                (rs, i) -> new Ponto(rs.getString("rotulo"), BigDecimal.valueOf(rs.getLong("valor"))),
                args.toArray()
        );
    }

    private List<Ponto> servicosMaisReceita(Integer empresaId, Periodo p, Integer profissionalId) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT COALESCE(es.nome_exibicao, ts.tipo_servico, 'Outros') AS rotulo,
                       COALESCE(SUM(pg.valor), 0) AS valor
                FROM flutz.pagamento pg
                LEFT JOIN flutz.agendamento g ON g.agendamento_id = pg.agendamento_id
                LEFT JOIN flutz.empresa_servico es ON es.empresa_servico_id = COALESCE(pg.empresa_servico_id, g.empresa_servico_id)
                LEFT JOIN flutz.tipo_servico ts ON ts.tipo_servico_id = es.tipo_servico_id
                WHERE pg.empresa_id = ?
                  AND pg.status_pagamento = 'PAGO'
                  AND COALESCE(pg.pago_em, pg.data_criacao) >= ?
                  AND COALESCE(pg.pago_em, pg.data_criacao) < ?
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        sql.append(" GROUP BY 1 ORDER BY valor DESC LIMIT 10 ");
        List<Ponto> pontos = jdbc.query(
                sql.toString(),
                (rs, i) -> new Ponto(rs.getString("rotulo"), rs.getBigDecimal("valor")),
                args.toArray()
        );
        if (!pontos.isEmpty()) {
            return pontos;
        }
        return jdbc.query(
                """
                SELECT COALESCE(es.nome_exibicao, ts.tipo_servico, v.nome_vacina, 'Outros') AS rotulo,
                       COALESCE(SUM(COALESCE(g.valor_cobrado, g.valor_servico, 0)), 0) AS valor
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                LEFT JOIN flutz.empresa_servico es ON es.empresa_servico_id = g.empresa_servico_id
                LEFT JOIN flutz.tipo_servico ts ON ts.tipo_servico_id = es.tipo_servico_id
                LEFT JOIN flutz.empresa_vacina ev ON ev.empresa_vacina_id = g.empresa_vacina_id
                LEFT JOIN flutz.vacina v ON v.vacina_id = ev.vacina_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                  AND st.codigo IN ('CONFIRMADO', 'CONCLUIDO', 'AGUARDANDO_PAGAMENTO')
                GROUP BY 1 ORDER BY valor DESC LIMIT 10
                """,
                (rs, i) -> new Ponto(rs.getString("rotulo"), rs.getBigDecimal("valor")),
                empresaId,
                Timestamp.valueOf(p.de().atStartOfDay()),
                Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay())
        );
    }

    private List<Ponto> ocupacaoPorDia(Integer empresaId, Periodo p, Integer profissionalId) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT TO_CHAR(g.data_hora_inicio, 'YYYY-MM-DD') AS rotulo, COUNT(*) AS valor
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.empresa_id = ?
                  AND g.data_hora_inicio >= ? AND g.data_hora_inicio < ?
                  AND st.codigo IN ('CONFIRMADO', 'AGUARDANDO_PAGAMENTO', 'AGUARDANDO_CLIENTE', 'CONCLUIDO')
                """
        );
        List<Object> args = new ArrayList<>();
        args.add(empresaId);
        args.add(Timestamp.valueOf(p.de().atStartOfDay()));
        args.add(Timestamp.valueOf(p.ate().plusDays(1).atStartOfDay()));
        if (profissionalId != null) {
            sql.append(" AND g.colaborador_id = ? ");
            args.add(profissionalId);
        }
        sql.append(" GROUP BY 1 ORDER BY 1 ");
        return jdbc.query(
                sql.toString(),
                (rs, i) -> new Ponto(rs.getString("rotulo"), BigDecimal.valueOf(rs.getLong("valor"))),
                args.toArray()
        );
    }

    private KpiDeltas deltas(Kpis a, Kpis b) {
        return new KpiDeltas(
                deltaPct(a.faturamento(), b.faturamento()),
                deltaPct(BigDecimal.valueOf(a.atendimentos()), BigDecimal.valueOf(b.atendimentos())),
                deltaPct(BigDecimal.valueOf(a.novosTutores()), BigDecimal.valueOf(b.novosTutores())),
                deltaPct(BigDecimal.valueOf(a.novosPets()), BigDecimal.valueOf(b.novosPets())),
                deltaPct(BigDecimal.valueOf(a.cancelamentos()), BigDecimal.valueOf(b.cancelamentos())),
                deltaPct(BigDecimal.valueOf(a.faltas()), BigDecimal.valueOf(b.faltas())),
                deltaPct(BigDecimal.valueOf(a.retornos()), BigDecimal.valueOf(b.retornos())),
                deltaPct(a.ticketMedio(), b.ticketMedio())
        );
    }

    private static BigDecimal deltaPct(BigDecimal atual, BigDecimal anterior) {
        if (anterior == null || anterior.compareTo(BigDecimal.ZERO) == 0) {
            if (atual == null || atual.compareTo(BigDecimal.ZERO) == 0) {
                return BigDecimal.ZERO;
            }
            return BigDecimal.valueOf(100);
        }
        return atual.subtract(anterior)
                .multiply(BigDecimal.valueOf(100))
                .divide(anterior.abs(), 1, RoundingMode.HALF_UP);
    }

    private Periodo resolverPeriodo(LocalDate de, LocalDate ate) {
        LocalDate hoje = LocalDate.now(ZONA);
        LocalDate ini = de == null ? hoje.minusDays(29) : de;
        LocalDate fim = ate == null ? hoje : ate;
        if (fim.isBefore(ini)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Período inválido");
        }
        if (ChronoUnit.DAYS.between(ini, fim) > 366) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Período máximo de 366 dias");
        }
        return new Periodo(ini, fim);
    }

    private Periodo periodoAnterior(Periodo atual) {
        long dias = ChronoUnit.DAYS.between(atual.de(), atual.ate()) + 1;
        LocalDate fim = atual.de().minusDays(1);
        LocalDate de = fim.minusDays(dias - 1);
        return new Periodo(de, fim);
    }

    private void exigirAdminClinica() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a equipe da clínica");
        }
        if (!(auth.temPapel("administrador") || auth.adminPlataforma())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica acessa relatórios");
        }
        clinic.empresaAtual();
    }

    private record Periodo(LocalDate de, LocalDate ate) {
    }

    public record Ponto(String rotulo, BigDecimal valor) {
    }

    public record Kpis(
            BigDecimal faturamento,
            long atendimentos,
            long novosTutores,
            long novosPets,
            long cancelamentos,
            long faltas,
            long retornos,
            BigDecimal ticketMedio,
            BigDecimal ocupacaoPercentual
    ) {
    }

    public record KpiDeltas(
            BigDecimal faturamento,
            BigDecimal atendimentos,
            BigDecimal novosTutores,
            BigDecimal novosPets,
            BigDecimal cancelamentos,
            BigDecimal faltas,
            BigDecimal retornos,
            BigDecimal ticketMedio
    ) {
    }

    public record VisaoGeral(
            String clinica,
            String periodoDe,
            String periodoAte,
            String periodoAnteriorDe,
            String periodoAnteriorAte,
            Kpis kpis,
            Kpis kpisAnterior,
            KpiDeltas deltas,
            List<Ponto> faturamentoSerie,
            List<Ponto> atendimentosSerie,
            List<Ponto> porStatus,
            List<Ponto> servicosVolume,
            List<Ponto> servicosReceita,
            List<Ponto> ocupacaoSerie
    ) {
    }
}
