package br.com.upvibe.flutz.clinic;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class NotificationService {

    public static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");

    private final JdbcTemplate jdbc;

    public NotificationService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<NotificacaoItem> minhas() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor() && !auth.colaborador() && !auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão");
        }
        String tipo = destinatarioTipo(auth);
        Integer destId = auth.atorId();
        if (destId == null) {
            return List.of();
        }
        return jdbc.query(
                """
                SELECT n.notificacao_id, n.tipo, n.titulo, n.corpo, n.link_path, n.referencia_tipo, n.referencia_id,
                       n.lida, n.data_criacao,
                       CASE
                         WHEN n.tipo = 'TICKET_SUPORTE' THEN (
                           SELECT e.logo_url FROM flutz.empresa e WHERE e.empresa_id = n.empresa_id
                         )
                         WHEN n.tipo = 'CHAT_MENSAGEM' AND n.destinatario_tipo = 'COLABORADOR' THEN (
                           SELECT cl.foto_url FROM flutz.chat ch
                           JOIN flutz.cliente cl ON cl.cliente_id = ch.cliente_id
                           WHERE ch.chat_id = n.referencia_id
                         )
                         WHEN n.tipo = 'CHAT_MENSAGEM' AND n.destinatario_tipo = 'CLIENTE' THEN (
                           SELECT e.logo_url FROM flutz.empresa e WHERE e.empresa_id = n.empresa_id
                         )
                         WHEN n.tipo IN ('AGENDA_SOLICITACAO', 'AGENDA_CANCELADA') AND n.destinatario_tipo = 'COLABORADOR' THEN (
                           SELECT cl.foto_url FROM flutz.agendamento g
                           JOIN flutz.cliente cl ON cl.cliente_id = g.cliente_id
                           WHERE g.agendamento_id = n.referencia_id
                         )
                         WHEN n.tipo IN ('AGENDA_CONFIRMADA', 'AGENDA_CANCELADA', 'AGENDA_RECUSADA', 'AGENDA_PROPOSTA', 'AGENDA_PAGAMENTO', 'ATENDIMENTO_D1', 'VACINA_D3', 'VACINA_D1')
                              AND n.destinatario_tipo = 'CLIENTE' THEN (
                           SELECT e.logo_url FROM flutz.empresa e WHERE e.empresa_id = n.empresa_id
                         )
                         WHEN n.tipo IN ('ATENDIMENTO_D1', 'ATENDIMENTO_H1') AND n.destinatario_tipo = 'COLABORADOR' THEN (
                           SELECT p.foto_url FROM flutz.agendamento g
                           JOIN flutz.pet p ON p.pet_id = g.pet_id
                           WHERE g.agendamento_id = n.referencia_id
                         )
                         ELSE (
                           SELECT e.logo_url FROM flutz.empresa e WHERE e.empresa_id = n.empresa_id
                         )
                       END AS foto_url,
                       CASE
                         WHEN n.tipo = 'TICKET_SUPORTE' THEN COALESCE(
                           (SELECT e.nome_empresa FROM flutz.empresa e WHERE e.empresa_id = n.empresa_id),
                           n.titulo
                         )
                         WHEN n.tipo = 'CHAT_MENSAGEM' AND n.destinatario_tipo = 'COLABORADOR' THEN (
                           SELECT cl.nome_cliente FROM flutz.chat ch
                           JOIN flutz.cliente cl ON cl.cliente_id = ch.cliente_id
                           WHERE ch.chat_id = n.referencia_id
                         )
                         WHEN n.tipo = 'CHAT_MENSAGEM' AND n.destinatario_tipo = 'CLIENTE' THEN (
                           SELECT e.nome_empresa FROM flutz.empresa e WHERE e.empresa_id = n.empresa_id
                         )
                         WHEN n.tipo IN ('AGENDA_SOLICITACAO', 'AGENDA_CANCELADA') AND n.destinatario_tipo = 'COLABORADOR' THEN (
                           SELECT cl.nome_cliente FROM flutz.agendamento g
                           JOIN flutz.cliente cl ON cl.cliente_id = g.cliente_id
                           WHERE g.agendamento_id = n.referencia_id
                         )
                         WHEN n.destinatario_tipo = 'CLIENTE' THEN (
                           SELECT e.nome_empresa FROM flutz.empresa e WHERE e.empresa_id = n.empresa_id
                         )
                         WHEN n.tipo IN ('ATENDIMENTO_D1', 'ATENDIMENTO_H1') AND n.destinatario_tipo = 'COLABORADOR' THEN (
                           SELECT p.nome_pet FROM flutz.agendamento g
                           JOIN flutz.pet p ON p.pet_id = g.pet_id
                           WHERE g.agendamento_id = n.referencia_id
                         )
                         ELSE NULL
                       END AS ator_nome
                FROM flutz.notificacao n
                WHERE n.destinatario_tipo = ? AND n.destinatario_id = ?
                ORDER BY n.data_criacao DESC
                LIMIT 80
                """,
                (rs, i) -> mapItem(rs),
                tipo, destId
        );
    }

    public long naoLidas() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor() && !auth.colaborador() && !auth.adminPlataforma()) {
            return 0;
        }
        String tipo = destinatarioTipo(auth);
        Long n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM flutz.notificacao
                WHERE destinatario_tipo = ? AND destinatario_id = ? AND lida = FALSE
                """,
                Long.class, tipo, auth.atorId()
        );
        return n == null ? 0 : n;
    }

    @Transactional
    public NotificacaoItem marcarLida(Integer id) {
        AuthPrincipal auth = AuthHolder.current();
        String tipo = destinatarioTipo(auth);
        NotificacaoItem item = jdbc.query(
                """
                SELECT n.notificacao_id, n.tipo, n.titulo, n.corpo, n.link_path, n.referencia_tipo, n.referencia_id,
                       n.lida, n.data_criacao, NULL::text AS foto_url, NULL::text AS ator_nome
                FROM flutz.notificacao n
                WHERE n.notificacao_id = ? AND n.destinatario_tipo = ? AND n.destinatario_id = ?
                """,
                rs -> rs.next() ? mapItem(rs) : null,
                id, tipo, auth.atorId()
        );
        if (item == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notificação não encontrada");
        }
        jdbc.update(
                """
                UPDATE flutz.notificacao
                SET lida = TRUE, lida_em = COALESCE(lida_em, ?)
                WHERE notificacao_id = ?
                """,
                Timestamp.from(Instant.now()), id
        );
        if (auth.colaborador()) {
            registrarVisualizacao(id, auth.atorId());
        }
        return new NotificacaoItem(
                item.id(), item.tipo(), item.titulo(), item.corpo(), item.linkPath(),
                item.referenciaTipo(), item.referenciaId(), true, item.quando(),
                item.fotoUrl(), item.atorNome()
        );
    }

    @Transactional
    public void marcarTodasLidas() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor() && !auth.colaborador() && !auth.adminPlataforma()) {
            return;
        }
        String tipo = destinatarioTipo(auth);
        jdbc.update(
                """
                UPDATE flutz.notificacao
                SET lida = TRUE, lida_em = COALESCE(lida_em, ?)
                WHERE destinatario_tipo = ? AND destinatario_id = ? AND lida = FALSE
                """,
                Timestamp.from(Instant.now()), tipo, auth.atorId()
        );
    }

    public List<LogNotificacao> logsClinica() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a clínica");
        }
        if (auth.colaborador() && !auth.temPapel("administrador") && !auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica");
        }
        Integer empresaId = auth.empresaId();
        if (empresaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione a clínica");
        }
        return jdbc.query(
                """
                SELECT n.notificacao_id, n.tipo, n.titulo, n.corpo, n.link_path, n.data_criacao,
                       c.colaborador_id AS destinatario_id,
                       c.nome_colaborador AS destinatario,
                       c.imagem_url AS destinatario_foto,
                       c.email AS destinatario_email,
                       c.cargo AS destinatario_cargo,
                       (
                         SELECT COALESCE(
                           json_agg(json_build_object(
                             'colaboradorId', v.colaborador_id,
                             'nome', cv.nome_colaborador,
                             'fotoUrl', cv.imagem_url,
                             'email', cv.email,
                             'cargo', cv.cargo,
                             'quando', to_char(v.visualizado_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                           ) ORDER BY v.visualizado_em),
                           '[]'::json
                         )
                         FROM flutz.notificacao_visualizacao v
                         JOIN flutz.colaborador cv ON cv.colaborador_id = v.colaborador_id
                         WHERE v.notificacao_id = n.notificacao_id
                       )::text AS visualizacoes
                FROM flutz.notificacao n
                JOIN flutz.colaborador c ON c.colaborador_id = n.destinatario_id
                WHERE n.empresa_id = ?
                  AND n.destinatario_tipo = 'COLABORADOR'
                ORDER BY n.data_criacao DESC
                LIMIT 500
                """,
                (rs, i) -> new LogNotificacao(
                        rs.getInt("notificacao_id"),
                        rs.getString("tipo"),
                        rs.getString("titulo"),
                        rs.getString("corpo"),
                        rs.getString("link_path"),
                        (Integer) rs.getObject("destinatario_id"),
                        rs.getString("destinatario"),
                        rs.getString("destinatario_foto"),
                        rs.getString("destinatario_email"),
                        rs.getString("destinatario_cargo"),
                        rs.getTimestamp("data_criacao").toInstant().toString(),
                        parseVisualizacoes(rs.getString("visualizacoes"))
                ),
                empresaId
        );
    }

    public void notificarChat(Integer chatId, Integer empresaId, Integer clienteId, String remetenteTipo, String preview) {
        String texto = preview == null || preview.isBlank() ? "Nova mensagem" : preview.trim();
        if (texto.length() > 160) {
            texto = texto.substring(0, 157) + "…";
        }
        if ("CLIENTE".equals(remetenteTipo)) {
            String titulo = "Nova mensagem do tutor";
            String corpo = texto;
            String link = "/app/chat?chatId=" + chatId;
            for (Integer colaboradorId : colaboradoresAtivos(empresaId)) {
                criarSePermitido(
                        "COLABORADOR", colaboradorId, empresaId, "CHAT_MENSAGEM",
                        titulo, corpo, link, "CHAT", chatId, null
                );
            }
        } else if ("COLABORADOR".equals(remetenteTipo)) {
            criarSePermitido(
                    "CLIENTE", clienteId, empresaId, "CHAT_MENSAGEM",
                    "Nova mensagem da clínica", texto,
                    "/cliente/chat?chatId=" + chatId, "CHAT", chatId, null
            );
        }
    }

    public void notificarSolicitacaoAgenda(AgendaService.Solicitacao item) {
        String pet = item.pet() == null ? "pet" : item.pet();
        String tutor = item.tutor() == null ? "tutor" : item.tutor();
        String titulo = "Nova marcação na agenda";
        String corpo = tutor + " solicitou horário para " + pet
                + (item.inicio() == null ? "" : " em " + formatarQuando(item.inicio()));
        String link = "/app/agenda?id=" + item.id();
        for (Integer colaboradorId : colaboradoresAtivos(item.empresaId())) {
            criarSePermitido(
                    "COLABORADOR", colaboradorId, item.empresaId(), "AGENDA_SOLICITACAO",
                    titulo, corpo, link, "AGENDAMENTO", item.id(), null
            );
        }
    }

    public void notificarConfirmacaoAgenda(AgendaService.Solicitacao item) {
        String pet = item.pet() == null ? "seu pet" : item.pet();
        String clinica = item.clinica() == null ? "a clínica" : item.clinica();
        criarSePermitido(
                "CLIENTE", item.clienteId(), item.empresaId(), "AGENDA_CONFIRMADA",
                "Atendimento confirmado",
                "O horário de " + pet + " em " + clinica + " foi confirmado"
                        + (item.inicio() == null ? "." : " para " + formatarQuando(item.inicio()) + "."),
                "/cliente/agenda?id=" + item.id(),
                "AGENDAMENTO", item.id(), null
        );
    }

    public void notificarAguardandoPagamento(AgendaService.Solicitacao item) {
        String pet = item.pet() == null ? "seu pet" : item.pet();
        String clinica = item.clinica() == null ? "a clínica" : item.clinica();
        String valor = item.valorCobrado() == null ? "" : " no valor de R$ "
                + item.valorCobrado().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString().replace('.', ',');
        criarSePermitido(
                "CLIENTE", item.clienteId(), item.empresaId(), "AGENDA_PAGAMENTO",
                "Aguardando pagamento",
                "A clínica aprovou o horário de " + pet + " em " + clinica + valor
                        + ". Pague para confirmar o agendamento.",
                "/cliente/agenda?id=" + item.id() + "&pagar=1",
                "AGENDAMENTO", item.id(), null
        );
    }

    public void notificarPropostaAgenda(AgendaService.Solicitacao item) {
        String pet = item.pet() == null ? "seu pet" : item.pet();
        String clinica = item.clinica() == null ? "a clínica" : item.clinica();
        String quando = item.propostaInicio() == null ? "" : " para " + formatarQuando(item.propostaInicio());
        criarSePermitido(
                "CLIENTE", item.clienteId(), item.empresaId(), "AGENDA_PROPOSTA",
                "Nova proposta de horário",
                clinica + " sugeriu um novo horário para " + pet + quando
                        + ". Abra a agenda para aceitar ou recusar.",
                "/cliente/agenda?id=" + item.id(),
                "AGENDAMENTO", item.id(), null
        );
    }

    public void notificarCancelamentoAgenda(AgendaService.Solicitacao item, boolean peloTutor) {
        String pet = item.pet() == null ? "seu pet" : item.pet();
        String clinica = item.clinica() == null ? "a clínica" : item.clinica();
        if (peloTutor) {
            for (Integer colaboradorId : colaboradoresAtivos(item.empresaId())) {
                criarSePermitido(
                        "COLABORADOR", colaboradorId, item.empresaId(), "AGENDA_CANCELADA",
                        "Agendamento cancelado pelo tutor",
                        (item.tutor() == null ? "O tutor" : item.tutor()) + " cancelou o horário de " + pet
                                + (item.inicio() == null ? "." : " (" + formatarQuando(item.inicio()) + ")."),
                        "/app/agenda?id=" + item.id(),
                        "AGENDAMENTO", item.id(), null
                );
            }
        } else {
            criarSePermitido(
                    "CLIENTE", item.clienteId(), item.empresaId(), "AGENDA_CANCELADA",
                    "Agendamento cancelado",
                    "O horário de " + pet + " em " + clinica + " foi cancelado"
                            + (item.inicio() == null ? "." : " (" + formatarQuando(item.inicio()) + ")."),
                    "/cliente/agenda?id=" + item.id(),
                    "AGENDAMENTO", item.id(), null
            );
        }
    }

    public void notificarRecusaAgenda(AgendaService.Solicitacao item) {
        String pet = item.pet() == null ? "seu pet" : item.pet();
        String clinica = item.clinica() == null ? "a clínica" : item.clinica();
        criarSePermitido(
                "CLIENTE", item.clienteId(), item.empresaId(), "AGENDA_RECUSADA",
                "Solicitação recusada",
                "A clínica " + clinica + " não pôde confirmar o horário de " + pet + ".",
                "/cliente/agenda?id=" + item.id(),
                "AGENDAMENTO", item.id(), null
        );
    }

    public void notificarTicketSuporte(
            Integer ticketId,
            Integer empresaId,
            String origem,
            String solicitante,
            String clinica,
            String motivo,
            String mensagem
    ) {
        if (ticketId == null) {
            return;
        }
        String quem = solicitante == null || solicitante.isBlank() ? "Alguém" : solicitante.trim();
        String deOnde = clinica == null || clinica.isBlank()
                ? origem
                : origem + " · " + clinica.trim();
        String titulo = "Novo pedido de suporte";
        String preview = mensagem == null ? "" : mensagem.trim();
        if (preview.length() > 140) {
            preview = preview.substring(0, 137) + "…";
        }
        String corpo = deOnde + " — " + quem + ": " + (motivo == null ? "Suporte" : motivo.trim())
                + (preview.isBlank() ? "" : " · " + preview);
        String link = "/admin/suporte";
        String chave = "TICKET_SUPORTE:" + ticketId;
        for (Integer adminId : administradoresAtivos()) {
            criarSePermitido(
                    "ADMINISTRADOR_SISTEMA", adminId, empresaId, "TICKET_SUPORTE",
                    titulo, corpo, link, "TICKET", ticketId, chave + ":" + adminId
            );
        }
    }

    public void notificarRespostaTicket(Integer ticketId, Integer empresaId, String motivo) {
        if (ticketId == null || empresaId == null) {
            return;
        }
        String titulo = "Resposta do suporte Flutz";
        String corpo = "A administração respondeu ao ticket "
                + (motivo == null || motivo.isBlank() ? "#" + ticketId : motivo.trim()) + ".";
        for (Integer colaboradorId : administradoresClinica(empresaId)) {
            criarSePermitido(
                    "COLABORADOR", colaboradorId, empresaId, "TICKET_RESPOSTA",
                    titulo, corpo, "/app/suporte", "TICKET", ticketId,
                    "TICKET_RESPOSTA:" + ticketId + ":" + colaboradorId
            );
        }
    }

    /** Avisa administradores da plataforma e confirma ao titular quando uma solicitação LGPD é criada. */
    public void notificarLgpdCriada(
            Integer solicitacaoId,
            Integer empresaId,
            String titularTipo,
            Integer titularId,
            String titularNome,
            String tipoSolicitacao,
            String status
    ) {
        if (solicitacaoId == null || titularId == null || titularTipo == null) {
            return;
        }
        String tipoLabel = tipoSolicitacao == null ? "LGPD" : tipoSolicitacao.trim();
        String quem = titularNome == null || titularNome.isBlank() ? "Titular" : titularNome.trim();
        String chaveBase = "LGPD_SOLICITACAO:" + solicitacaoId;

        for (Integer adminId : administradoresAtivos()) {
            criarSePermitido(
                    "ADMINISTRADOR_SISTEMA", adminId, empresaId, "LGPD_SOLICITACAO",
                    "Nova solicitação LGPD",
                    quem + " (" + titularTipo + ") abriu " + tipoLabel + " · status " + status + ".",
                    "/admin/lgpd",
                    "LGPD", solicitacaoId,
                    chaveBase + ":ADMIN:" + adminId
            );
        }

        String destTipo = "CLIENTE".equals(titularTipo) ? "CLIENTE" : "COLABORADOR";
        String linkTitular = "CLIENTE".equals(titularTipo) ? "/cliente/meus-dados" : "/app/meus-dados";
        criarSePermitido(
                destTipo, titularId, empresaId, "LGPD_SOLICITACAO",
                "Solicitação LGPD registrada",
                "Recebemos sua solicitação de " + tipoLabel + ". Protocolo #" + solicitacaoId + ".",
                linkTitular,
                "LGPD", solicitacaoId,
                chaveBase + ":TITULAR"
        );
    }

    /** Avisa o titular quando o status da solicitação LGPD muda. */
    public void notificarLgpdStatus(
            Integer solicitacaoId,
            Integer empresaId,
            String titularTipo,
            Integer titularId,
            String tipoSolicitacao,
            String status,
            String motivoNegativa
    ) {
        if (solicitacaoId == null || titularId == null || titularTipo == null) {
            return;
        }
        String destTipo = "CLIENTE".equals(titularTipo) ? "CLIENTE" : "COLABORADOR";
        String linkTitular = "CLIENTE".equals(titularTipo) ? "/cliente/meus-dados" : "/app/meus-dados";
        String tipoLabel = tipoSolicitacao == null ? "LGPD" : tipoSolicitacao.trim();
        String statusLabel = status == null ? "atualizado" : status.trim();
        String corpo = "Sua solicitação de " + tipoLabel + " (#" + solicitacaoId + ") agora está: " + statusLabel + ".";
        if ("NEGADA".equalsIgnoreCase(statusLabel) && motivoNegativa != null && !motivoNegativa.isBlank()) {
            corpo = corpo + " Motivo: " + motivoNegativa.trim();
        }
        criarSePermitido(
                destTipo, titularId, empresaId, "LGPD_ATUALIZACAO",
                "Atualização da solicitação LGPD",
                corpo,
                linkTitular,
                "LGPD", solicitacaoId,
                "LGPD_ATUALIZACAO:" + solicitacaoId + ":" + statusLabel
        );
    }

    /** Contagem de não lidas para um destinatário (uso no stream SSE). */
    public long contarNaoLidas(String destinatarioTipo, Integer destinatarioId) {
        if (destinatarioTipo == null || destinatarioId == null) {
            return 0;
        }
        Long n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM flutz.notificacao
                WHERE destinatario_tipo = ? AND destinatario_id = ? AND lida = FALSE
                """,
                Long.class, destinatarioTipo, destinatarioId
        );
        return n == null ? 0 : n;
    }

    public String destinatarioTipoPublico(AuthPrincipal auth) {
        return destinatarioTipo(auth);
    }

    @Transactional
    public int processarVacinasProximas() {
        LocalDate hoje = LocalDate.now(ZONA);
        LocalDate em3 = hoje.plusDays(3);
        LocalDate amanha = hoje.plusDays(1);
        int criadas = 0;
        criadas += emitirVacinas(em3, "VACINA_D3", hoje);
        criadas += emitirVacinas(amanha, "VACINA_D1", hoje);
        return criadas;
    }

    /** Aviso D-3 de vencimento de fatura de assinatura para administradores da clínica. */
    @Transactional
    public int processarAssinaturaD3() {
        LocalDate alvo = LocalDate.now(ZONA).plusDays(3);
        List<FaturaAssinaturaRow> faturas = jdbc.query(
                """
                SELECT f.fatura_assinatura_id, f.empresa_id, f.valor, f.data_vencimento, e.nome_empresa
                FROM flutz.fatura_assinatura f
                JOIN flutz.empresa e ON e.empresa_id = f.empresa_id
                WHERE f.status_fatura IN ('PENDENTE', 'ATRASADA')
                  AND f.data_vencimento = ?
                """,
                (rs, i) -> new FaturaAssinaturaRow(
                        rs.getInt("fatura_assinatura_id"),
                        rs.getInt("empresa_id"),
                        rs.getBigDecimal("valor"),
                        rs.getDate("data_vencimento").toLocalDate(),
                        rs.getString("nome_empresa")
                ),
                java.sql.Date.valueOf(alvo)
        );
        int criadas = 0;
        for (FaturaAssinaturaRow fatura : faturas) {
            String valor = fatura.valor() == null
                    ? ""
                    : " (R$ " + fatura.valor().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString().replace('.', ',') + ")";
            String titulo = "Assinatura vence em 3 dias";
            String corpo = "Faltam 3 dias para o pagamento da assinatura"
                    + valor
                    + ". Vencimento em "
                    + fatura.vencimento().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                    + ".";
            for (Integer colaboradorId : administradoresClinica(fatura.empresaId())) {
                String chave = "ASSINATURA_D3:" + fatura.faturaId() + ":" + colaboradorId;
                if (criarSePermitido(
                        "COLABORADOR", colaboradorId, fatura.empresaId(), "ASSINATURA_D3",
                        titulo, corpo, "/app/assinatura",
                        "FATURA", fatura.faturaId(), chave
                )) {
                    criadas++;
                }
            }
        }
        return criadas;
    }

    @Transactional
    public int processarLembretesAtendimento() {
        int criadas = 0;
        List<LembreteRow> d1 = jdbc.query(
                """
                SELECT g.agendamento_id, g.empresa_id, g.cliente_id, g.colaborador_id,
                       p.nome_pet, e.nome_empresa, g.data_hora_inicio
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                JOIN flutz.pet p ON p.pet_id = g.pet_id
                JOIN flutz.empresa e ON e.empresa_id = g.empresa_id
                WHERE st.codigo = 'CONFIRMADO'
                  AND (g.data_hora_inicio AT TIME ZONE 'America/Sao_Paulo')::date
                      = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + 1
                """,
                (rs, i) -> new LembreteRow(
                        rs.getInt("agendamento_id"),
                        rs.getInt("empresa_id"),
                        rs.getInt("cliente_id"),
                        (Integer) rs.getObject("colaborador_id"),
                        rs.getString("nome_pet"),
                        rs.getString("nome_empresa"),
                        rs.getTimestamp("data_hora_inicio").toInstant()
                )
        );
        for (LembreteRow row : d1) {
            String quando = formatarQuando(row.inicio().toString());
            String corpoTutor = "Amanhã " + row.pet() + " tem atendimento em " + row.clinica()
                    + " às " + quando + ".";
            if (criarSePermitido(
                    "CLIENTE", row.clienteId(), row.empresaId(), "ATENDIMENTO_D1",
                    "Lembrete de atendimento", corpoTutor,
                    "/cliente/agenda?id=" + row.id(), "AGENDAMENTO", row.id(),
                    "ATEND_D1_TUTOR:" + row.id()
            )) {
                criadas++;
            }
            if (row.colaboradorId() != null) {
                String corpoVet = "Amanhã você atende " + row.pet() + " em " + quando + ".";
                if (criarSePermitido(
                        "COLABORADOR", row.colaboradorId(), row.empresaId(), "ATENDIMENTO_D1",
                        "Lembrete de atendimento", corpoVet,
                        "/app/agenda?id=" + row.id(), "AGENDAMENTO", row.id(),
                        "ATEND_D1_VET:" + row.id()
                )) {
                    criadas++;
                }
            }
        }

        List<LembreteRow> h1 = jdbc.query(
                """
                SELECT g.agendamento_id, g.empresa_id, g.cliente_id, g.colaborador_id,
                       p.nome_pet, e.nome_empresa, g.data_hora_inicio
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                JOIN flutz.pet p ON p.pet_id = g.pet_id
                JOIN flutz.empresa e ON e.empresa_id = g.empresa_id
                WHERE st.codigo = 'CONFIRMADO'
                  AND g.colaborador_id IS NOT NULL
                  AND g.data_hora_inicio BETWEEN (CURRENT_TIMESTAMP + INTERVAL '50 minutes')
                                            AND (CURRENT_TIMESTAMP + INTERVAL '70 minutes')
                """,
                (rs, i) -> new LembreteRow(
                        rs.getInt("agendamento_id"),
                        rs.getInt("empresa_id"),
                        rs.getInt("cliente_id"),
                        (Integer) rs.getObject("colaborador_id"),
                        rs.getString("nome_pet"),
                        rs.getString("nome_empresa"),
                        rs.getTimestamp("data_hora_inicio").toInstant()
                )
        );
        for (LembreteRow row : h1) {
            if (row.colaboradorId() == null) {
                continue;
            }
            String corpo = "Em cerca de 1 hora você atende " + row.pet() + " (" + formatarQuando(row.inicio().toString()) + ").";
            if (criarSePermitido(
                    "COLABORADOR", row.colaboradorId(), row.empresaId(), "ATENDIMENTO_H1",
                    "Atendimento em 1 hora", corpo,
                    "/app/agenda?id=" + row.id(), "AGENDAMENTO", row.id(),
                    "ATEND_H1_VET:" + row.id()
            )) {
                criadas++;
            }
        }
        return criadas;
    }

    private int emitirVacinas(LocalDate dataDose, String tipo, LocalDate refHoje) {
        List<VacinaRow> rows = jdbc.query(
                """
                SELECT h.historico_vacinacao_id, p.cliente_id, p.nome_pet, v.nome_vacina,
                       COALESCE(
                         (SELECT e.nome_empresa
                          FROM flutz.colaborador c
                          JOIN flutz.empresa e ON e.empresa_id = c.empresa_id
                          WHERE c.colaborador_id = h.colaborador_id),
                         (SELECT e.nome_empresa
                          FROM flutz.empresa_cliente ec
                          JOIN flutz.empresa e ON e.empresa_id = ec.empresa_id
                          WHERE ec.cliente_id = p.cliente_id
                          ORDER BY ec.empresa_cliente_id
                          LIMIT 1),
                         'sua clínica'
                       ) AS clinica,
                       COALESCE(
                         (SELECT c.empresa_id FROM flutz.colaborador c WHERE c.colaborador_id = h.colaborador_id),
                         (SELECT ec.empresa_id FROM flutz.empresa_cliente ec
                          WHERE ec.cliente_id = p.cliente_id ORDER BY ec.empresa_cliente_id LIMIT 1)
                       ) AS empresa_id
                FROM flutz.historico_vacinacao h
                JOIN flutz.pet p ON p.pet_id = h.pet_id
                JOIN flutz.vacina v ON v.vacina_id = h.vacina_id
                WHERE h.data_proxima_dose = ?
                """,
                (rs, i) -> new VacinaRow(
                        rs.getInt("historico_vacinacao_id"),
                        rs.getInt("cliente_id"),
                        (Integer) rs.getObject("empresa_id"),
                        rs.getString("nome_pet"),
                        rs.getString("nome_vacina"),
                        rs.getString("clinica")
                ),
                java.sql.Date.valueOf(dataDose)
        );
        int criadas = 0;
        for (VacinaRow row : rows) {
            String titulo;
            String corpo;
            if ("VACINA_D1".equals(tipo)) {
                titulo = "Vacina amanhã";
                corpo = "Amanhã o " + row.pet() + " será vacinado com " + row.vacina()
                        + " no(a) " + row.clinica() + ". Já vá se preparando!!!";
            } else {
                titulo = "Vacina em 3 dias";
                corpo = "Em 3 dias, " + row.pet() + " precisa tomar " + row.vacina()
                        + " no(a) " + row.clinica() + ".";
            }
            String chave = tipo + ":" + row.historicoId() + ":" + refHoje;
            if (criarSePermitido(
                    "CLIENTE", row.clienteId(), row.empresaId(), tipo,
                    titulo, corpo, "/cliente/vacinacao?doseId=" + row.historicoId(),
                    "VACINA", row.historicoId(), chave
            )) {
                criadas++;
            }
        }
        return criadas;
    }

    private boolean criarSePermitido(
            String destinatarioTipo,
            Integer destinatarioId,
            Integer empresaId,
            String tipo,
            String titulo,
            String corpo,
            String linkPath,
            String referenciaTipo,
            Integer referenciaId,
            String chaveUnica
    ) {
        if (destinatarioId == null) {
            return false;
        }
        if (!permiteNotificacoes(destinatarioTipo, destinatarioId)) {
            return false;
        }
        try {
            jdbc.update(
                    """
                    INSERT INTO flutz.notificacao (
                      destinatario_tipo, destinatario_id, empresa_id, tipo, titulo, corpo,
                      link_path, referencia_tipo, referencia_id, chave_unica
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    destinatarioTipo, destinatarioId, empresaId, tipo, titulo, corpo,
                    linkPath, referenciaTipo, referenciaId, chaveUnica
            );
            return true;
        } catch (DataIntegrityViolationException ex) {
            return false;
        }
    }

    private boolean permiteNotificacoes(String tipo, Integer id) {
        if ("ADMINISTRADOR_SISTEMA".equals(tipo)) {
            Boolean ok = jdbc.query(
                    """
                    SELECT COUNT(*) > 0
                    FROM flutz.administrador_sistema a
                    JOIN flutz.status s ON s.status_id = a.status_id
                    WHERE a.administrador_sistema_id = ?
                      AND a.anonimizado_em IS NULL
                      AND LOWER(s.descricao) = 'ativo'
                    """,
                    rs -> rs.next() && rs.getBoolean(1),
                    id
            );
            return Boolean.TRUE.equals(ok);
        }
        String sql = "CLIENTE".equals(tipo)
                ? "SELECT COALESCE(permitir_notificacoes, TRUE) FROM flutz.cliente WHERE cliente_id = ?"
                : "SELECT COALESCE(permitir_notificacoes, TRUE) FROM flutz.colaborador WHERE colaborador_id = ?";
        Boolean ok = jdbc.query(sql, rs -> rs.next() && rs.getBoolean(1), id);
        return Boolean.TRUE.equals(ok);
    }

    private List<Integer> administradoresAtivos() {
        return jdbc.query(
                """
                SELECT a.administrador_sistema_id
                FROM flutz.administrador_sistema a
                JOIN flutz.status s ON s.status_id = a.status_id
                WHERE a.anonimizado_em IS NULL AND LOWER(s.descricao) = 'ativo'
                """,
                (rs, i) -> rs.getInt(1)
        );
    }

    private List<Integer> colaboradoresAtivos(Integer empresaId) {
        if (empresaId == null) {
            return List.of();
        }
        return jdbc.query(
                """
                SELECT c.colaborador_id
                FROM flutz.colaborador c
                JOIN flutz.status s ON s.status_id = c.status_id
                WHERE c.empresa_id = ? AND LOWER(s.descricao) = 'ativo'
                  AND COALESCE(c.permitir_notificacoes, TRUE) = TRUE
                """,
                (rs, i) -> rs.getInt(1),
                empresaId
        );
    }

    private List<Integer> administradoresClinica(Integer empresaId) {
        if (empresaId == null) {
            return List.of();
        }
        return jdbc.query(
                """
                SELECT DISTINCT c.colaborador_id
                FROM flutz.colaborador c
                JOIN flutz.status s ON s.status_id = c.status_id
                JOIN flutz.colaborador_role cr ON cr.colaborador_id = c.colaborador_id
                JOIN flutz.role r ON r.role_id = cr.role_id
                WHERE c.empresa_id = ?
                  AND LOWER(s.descricao) = 'ativo'
                  AND LOWER(r.descricao) = 'administrador'
                  AND COALESCE(c.permitir_notificacoes, TRUE) = TRUE
                """,
                (rs, i) -> rs.getInt(1),
                empresaId
        );
    }

    private void registrarVisualizacao(Integer notificacaoId, Integer colaboradorId) {
        jdbc.update(
                """
                INSERT INTO flutz.notificacao_visualizacao (notificacao_id, colaborador_id)
                VALUES (?, ?)
                ON CONFLICT (notificacao_id, colaborador_id) DO NOTHING
                """,
                notificacaoId, colaboradorId
        );
    }

    private static String destinatarioTipo(AuthPrincipal auth) {
        if (auth.tutor()) {
            return "CLIENTE";
        }
        if (auth.adminPlataforma()) {
            return "ADMINISTRADOR_SISTEMA";
        }
        return "COLABORADOR";
    }

    private static String formatarQuando(String iso) {
        try {
            Instant instant = Instant.parse(iso);
            return instant.atZone(ZONA)
                    .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        } catch (Exception ex) {
            return iso;
        }
    }

    private static List<Visualizacao> parseVisualizacoes(String json) {
        if (json == null || json.isBlank() || "[]".equals(json)) {
            return List.of();
        }
        // Formato simples gerado pelo Postgres; parse manual leve.
        List<Visualizacao> out = new ArrayList<>();
        String cleaned = json.replace("[", "").replace("]", "");
        if (cleaned.isBlank()) {
            return out;
        }
        // Preferir jackson via ObjectMapper would be better; keep robust fallback.
        try {
            com.fasterxml.jackson.databind.JsonNode arr =
                    new com.fasterxml.jackson.databind.ObjectMapper().readTree(json);
            if (arr.isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode n : arr) {
                    out.add(new Visualizacao(
                            n.path("colaboradorId").isMissingNode() ? null : n.path("colaboradorId").asInt(),
                            n.path("nome").asText(null),
                            n.path("fotoUrl").asText(null),
                            n.path("email").asText(null),
                            n.path("cargo").asText(null),
                            n.path("quando").asText(null)
                    ));
                }
            }
        } catch (Exception ignored) {
            // ignore malformed
        }
        return out;
    }

    private record VacinaRow(
            Integer historicoId, Integer clienteId, Integer empresaId, String pet, String vacina, String clinica
    ) {
    }

    private record LembreteRow(
            Integer id, Integer empresaId, Integer clienteId, Integer colaboradorId,
            String pet, String clinica, Instant inicio
    ) {
    }

    private record FaturaAssinaturaRow(
            Integer faturaId,
            Integer empresaId,
            java.math.BigDecimal valor,
            LocalDate vencimento,
            String clinica
    ) {
    }

    private static NotificacaoItem mapItem(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new NotificacaoItem(
                rs.getInt("notificacao_id"),
                rs.getString("tipo"),
                rs.getString("titulo"),
                rs.getString("corpo"),
                rs.getString("link_path"),
                rs.getString("referencia_tipo"),
                (Integer) rs.getObject("referencia_id"),
                rs.getBoolean("lida"),
                rs.getTimestamp("data_criacao").toInstant().toString(),
                rs.getString("foto_url"),
                rs.getString("ator_nome")
        );
    }

    public record NotificacaoItem(
            Integer id,
            String tipo,
            String titulo,
            String corpo,
            String linkPath,
            String referenciaTipo,
            Integer referenciaId,
            boolean lida,
            String quando,
            String fotoUrl,
            String atorNome
    ) {
    }

    public record Visualizacao(
            Integer colaboradorId,
            String nome,
            String fotoUrl,
            String email,
            String cargo,
            String quando
    ) {
    }

    public record LogNotificacao(
            Integer id,
            String tipo,
            String titulo,
            String corpo,
            String linkPath,
            Integer destinatarioId,
            String destinatario,
            String destinatarioFotoUrl,
            String destinatarioEmail,
            String destinatarioCargo,
            String quando,
            List<Visualizacao> visualizacoes
    ) {
    }
}
