package br.com.upvibe.flutz.support;

import java.util.List;

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
public class SupportService {

    private static final Logger log = LoggerFactory.getLogger(SupportService.class);

    private final JdbcTemplate jdbc;
    private final EmailService email;
    private final AppProperties properties;
    private final NotificationService notifications;

    public SupportService(
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

    @Transactional
    public TicketMeu abrir(NovoTicket req) {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "A administração recebe os tickets, não os abre.");
        }
        if (!auth.tutor() && !auth.colaborador()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Entre com a conta da clínica ou do tutor para pedir suporte.");
        }
        String motivo = texto(req.motivo(), 180, "Informe o motivo do ticket");
        String mensagem = texto(req.mensagem(), 4000, "Conte como podemos te ajudar");
        Contato contato = contato(auth);
        TicketMeu criado = jdbc.query(
                """
                INSERT INTO flutz.ticket_suporte
                    (tipo_solicitante, ator_id, empresa_id, nome_solicitante, email_contato, motivo, mensagem, status_ticket)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'ABERTO')
                RETURNING ticket_suporte_id, motivo, mensagem, status_ticket, criado_em, resposta, respondido_em
                """,
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível abrir o ticket");
                    }
                    return new TicketMeu(
                            rs.getInt("ticket_suporte_id"),
                            rs.getString("motivo"),
                            rs.getString("mensagem"),
                            rs.getString("status_ticket"),
                            rs.getTimestamp("criado_em").toInstant().toString(),
                            rs.getString("resposta"),
                            null
                    );
                },
                auth.tipo().name(),
                auth.atorId(),
                auth.empresaId(),
                contato.nome(),
                contato.email(),
                motivo,
                mensagem
        );
        avisarAdministracao(auth, contato, motivo, mensagem);
        notifications.notificarTicketSuporte(
                criado.id(),
                auth.empresaId(),
                origem(auth.tipo().name()),
                contato.nome(),
                clinicaNome(auth.empresaId()),
                motivo,
                mensagem
        );
        return criado;
    }

    public List<TicketMeu> listarMeus() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Use a área administrativa de tickets");
        }
        if (auth.colaborador()) {
            Integer empresaId = auth.empresaId();
            if (empresaId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione a clínica");
            }
            return jdbc.query(
                    """
                    SELECT ticket_suporte_id, motivo, mensagem, status_ticket, criado_em, resposta, respondido_em
                    FROM flutz.ticket_suporte
                    WHERE empresa_id = ?
                    ORDER BY criado_em DESC
                    LIMIT 50
                    """,
                    (rs, row) -> mapTicketMeu(rs),
                    empresaId
            );
        }
        if (auth.tutor()) {
            return jdbc.query(
                    """
                    SELECT ticket_suporte_id, motivo, mensagem, status_ticket, criado_em, resposta, respondido_em
                    FROM flutz.ticket_suporte
                    WHERE tipo_solicitante = 'CLIENTE' AND ator_id = ?
                    ORDER BY criado_em DESC
                    LIMIT 50
                    """,
                    (rs, row) -> mapTicketMeu(rs),
                    auth.atorId()
            );
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Entre com a conta da clínica ou do tutor");
    }

    @Transactional
    public TicketMeu editar(Integer id, NovoTicket req) {
        TicketRow ticket = carregarProprioAberto(id);
        String motivo = texto(req.motivo(), 180, "Informe o motivo do ticket");
        String mensagem = texto(req.mensagem(), 4000, "Conte como podemos te ajudar");
        return jdbc.query(
                """
                UPDATE flutz.ticket_suporte
                SET motivo = ?, mensagem = ?
                WHERE ticket_suporte_id = ?
                RETURNING ticket_suporte_id, motivo, mensagem, status_ticket, criado_em, resposta, respondido_em
                """,
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket não encontrado");
                    }
                    return mapTicketMeu(rs);
                },
                motivo, mensagem, ticket.id()
        );
    }

    @Transactional
    public TicketMeu excluir(Integer id) {
        TicketRow ticket = carregarProprioAberto(id);
        TicketMeu atual = jdbc.query(
                """
                SELECT ticket_suporte_id, motivo, mensagem, status_ticket, criado_em, resposta, respondido_em
                FROM flutz.ticket_suporte
                WHERE ticket_suporte_id = ?
                """,
                rs -> rs.next() ? mapTicketMeu(rs) : null,
                ticket.id()
        );
        if (atual == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket não encontrado");
        }
        jdbc.update("DELETE FROM flutz.ticket_suporte WHERE ticket_suporte_id = ?", ticket.id());
        return atual;
    }

    private TicketRow carregarProprioAberto(Integer id) {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "A administração não edita tickets por aqui");
        }
        if (!auth.tutor() && !auth.colaborador()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Entre com a conta da clínica ou do tutor");
        }
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o ticket");
        }
        TicketRow ticket = jdbc.query(
                """
                SELECT ticket_suporte_id, tipo_solicitante, ator_id, empresa_id, status_ticket
                FROM flutz.ticket_suporte
                WHERE ticket_suporte_id = ?
                """,
                rs -> rs.next()
                        ? new TicketRow(
                        rs.getInt("ticket_suporte_id"),
                        rs.getString("tipo_solicitante"),
                        (Integer) rs.getObject("ator_id"),
                        (Integer) rs.getObject("empresa_id"),
                        rs.getString("status_ticket")
                )
                        : null,
                id
        );
        if (ticket == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket não encontrado");
        }
        if (!"ABERTO".equalsIgnoreCase(ticket.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Só é possível alterar tickets abertos");
        }
        if (auth.tutor()) {
            if (!"CLIENTE".equalsIgnoreCase(ticket.tipoSolicitante()) || !auth.atorId().equals(ticket.atorId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este ticket não é seu");
            }
            return ticket;
        }
        Integer empresaId = auth.empresaId();
        if (empresaId == null || ticket.empresaId() == null || !empresaId.equals(ticket.empresaId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este ticket não é da sua clínica");
        }
        return ticket;
    }

    public List<TicketAdmin> listar() {
        if (!AuthHolder.current().adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da plataforma");
        }
        return jdbc.query(
                """
                SELECT t.ticket_suporte_id, t.tipo_solicitante, t.nome_solicitante, t.email_contato,
                       t.motivo, t.mensagem, t.status_ticket, t.criado_em, t.resposta, t.respondido_em, e.nome_empresa
                FROM flutz.ticket_suporte t
                LEFT JOIN flutz.empresa e ON e.empresa_id = t.empresa_id
                ORDER BY t.criado_em DESC
                """,
                (rs, row) -> mapTicketAdmin(rs)
        );
    }

    @Transactional
    public TicketAdmin atualizarStatus(Integer id, String status) {
        if (!AuthHolder.current().adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da plataforma");
        }
        String destino = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("ABERTO", "EM_ANDAMENTO", "RESOLVIDO").contains(destino)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status inválido");
        }
        int updated = jdbc.update(
                "UPDATE flutz.ticket_suporte SET status_ticket = ? WHERE ticket_suporte_id = ?",
                destino, id
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket não encontrado");
        }
        return jdbc.query(
                """
                SELECT t.ticket_suporte_id, t.tipo_solicitante, t.nome_solicitante, t.email_contato,
                       t.motivo, t.mensagem, t.status_ticket, t.criado_em, t.resposta, t.respondido_em, e.nome_empresa
                FROM flutz.ticket_suporte t
                LEFT JOIN flutz.empresa e ON e.empresa_id = t.empresa_id
                WHERE t.ticket_suporte_id = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket não encontrado");
                    }
                    return mapTicketAdmin(rs);
                },
                id
        );
    }

    @Transactional
    public TicketAdmin responder(Integer id, String resposta, String status) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da plataforma");
        }
        String textoResposta = texto(resposta, 8000, "Escreva a resposta do ticket");
        String destino = status == null || status.isBlank() ? "EM_ANDAMENTO" : status.trim().toUpperCase();
        if (!List.of("EM_ANDAMENTO", "RESOLVIDO").contains(destino)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status inválido para a resposta");
        }
        TicketDestino ticket = jdbc.query(
                "SELECT empresa_id, motivo FROM flutz.ticket_suporte WHERE ticket_suporte_id = ?",
                rs -> rs.next() ? new TicketDestino((Integer) rs.getObject(1), rs.getString(2)) : null,
                id
        );
        if (ticket == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket não encontrado");
        }
        jdbc.update(
                """
                UPDATE flutz.ticket_suporte
                SET resposta = ?, respondido_em = CURRENT_TIMESTAMP, respondido_por = ?, status_ticket = ?
                WHERE ticket_suporte_id = ?
                """,
                textoResposta, auth.atorId(), destino, id
        );
        notifications.notificarRespostaTicket(id, ticket.empresaId(), ticket.motivo());
        return ticketAdminPorId(id);
    }

    private TicketAdmin ticketAdminPorId(Integer id) {
        return jdbc.query(
                """
                SELECT t.ticket_suporte_id, t.tipo_solicitante, t.nome_solicitante, t.email_contato,
                       t.motivo, t.mensagem, t.status_ticket, t.criado_em, t.resposta, t.respondido_em,
                       e.nome_empresa
                FROM flutz.ticket_suporte t
                LEFT JOIN flutz.empresa e ON e.empresa_id = t.empresa_id
                WHERE t.ticket_suporte_id = ?
                """,
                rs -> rs.next() ? mapTicketAdmin(rs) : null,
                id
        );
    }

    private static TicketAdmin mapTicketAdmin(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new TicketAdmin(
                rs.getInt("ticket_suporte_id"),
                origem(rs.getString("tipo_solicitante")),
                rs.getString("nome_solicitante"),
                rs.getString("email_contato"),
                rs.getString("nome_empresa"),
                rs.getString("motivo"),
                rs.getString("mensagem"),
                rs.getString("status_ticket"),
                rs.getTimestamp("criado_em").toInstant().toString(),
                rs.getString("resposta"),
                rs.getTimestamp("respondido_em") == null ? null : rs.getTimestamp("respondido_em").toInstant().toString()
        );
    }

    private static TicketMeu mapTicketMeu(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new TicketMeu(
                rs.getInt("ticket_suporte_id"),
                rs.getString("motivo"),
                rs.getString("mensagem"),
                rs.getString("status_ticket"),
                rs.getTimestamp("criado_em").toInstant().toString(),
                rs.getString("resposta"),
                rs.getTimestamp("respondido_em") == null ? null : rs.getTimestamp("respondido_em").toInstant().toString()
        );
    }

    private Contato contato(AuthPrincipal auth) {
        if (auth.tutor()) {
            return jdbc.query(
                    "SELECT nome_cliente, email FROM flutz.cliente WHERE cliente_id = ?",
                    rs -> {
                        if (!rs.next()) {
                            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil não encontrado");
                        }
                        String mail = rs.getString("email");
                        if (mail == null || mail.isBlank()) {
                            throw new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    "Cadastre um e-mail em Alterar dados para receber o retorno do suporte."
                            );
                        }
                        return new Contato(rs.getString("nome_cliente"), mail.trim());
                    },
                    auth.atorId()
            );
        }
        return jdbc.query(
                "SELECT nome_colaborador, email FROM flutz.colaborador WHERE colaborador_id = ?",
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil não encontrado");
                    }
                    return new Contato(rs.getString("nome_colaborador"), rs.getString("email"));
                },
                auth.atorId()
        );
    }

    private void avisarAdministracao(AuthPrincipal auth, Contato contato, String motivo, String mensagem) {
        String destino = properties.admin() != null ? properties.admin().email() : null;
        if (destino == null || destino.isBlank()) {
            log.warn("Ticket de suporte criado sem e-mail da administração configurado");
            return;
        }
        String origem = origem(auth.tipo().name());
        String clinica = clinicaNome(auth.empresaId());
        String corpo = """
                Novo pedido de suporte no Flutz

                Origem: %s
                Nome: %s
                E-mail: %s
                Clínica: %s
                Motivo: %s

                %s
                """.formatted(
                origem,
                contato.nome(),
                contato.email(),
                clinica == null || clinica.isBlank() ? "—" : clinica,
                motivo,
                mensagem
        );
        try {
            email.send(destino, "Suporte Flutz: " + motivo, corpo);
        } catch (RuntimeException ex) {
            log.error("Ticket gravado, mas o aviso por e-mail falhou", ex);
        }
    }

    private String clinicaNome(Integer empresaId) {
        if (empresaId == null) {
            return null;
        }
        return jdbc.query(
                "SELECT nome_empresa FROM flutz.empresa WHERE empresa_id = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                empresaId
        );
    }

    private static String origem(String tipo) {
        if ("CLIENTE".equalsIgnoreCase(tipo)) {
            return "Tutor";
        }
        if ("COLABORADOR".equalsIgnoreCase(tipo)) {
            return "Clínica";
        }
        return tipo;
    }

    private static String texto(String value, int max, String vazio) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, vazio);
        }
        String trimmed = value.trim();
        if (trimmed.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O texto está longo demais");
        }
        return trimmed;
    }

    public record NovoTicket(String motivo, String mensagem) {
    }

    public record StatusTicket(String status) {
    }

    public record RespostaTicket(String resposta, String status) {
    }

    public record TicketMeu(
            Integer id,
            String motivo,
            String mensagem,
            String status,
            String criadoEm,
            String resposta,
            String respondidoEm
    ) {
    }

    /** @deprecated Prefer TicketMeu; mantido para compatibilidade de clientes antigos. */
    public record TicketResumo(String status) {
    }

    public record TicketAdmin(
            Integer id,
            String origem,
            String nome,
            String email,
            String clinica,
            String motivo,
            String mensagem,
            String status,
            String criadoEm,
            String resposta,
            String respondidoEm
    ) {
    }

    private record Contato(String nome, String email) {
    }

    private record TicketRow(
            Integer id,
            String tipoSolicitante,
            Integer atorId,
            Integer empresaId,
            String status
    ) {
    }

    private record TicketDestino(Integer empresaId, String motivo) {
    }
}
