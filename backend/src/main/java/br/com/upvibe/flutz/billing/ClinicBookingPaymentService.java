package br.com.upvibe.flutz.billing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.mercadopago.resources.payment.Payment;

import br.com.upvibe.flutz.clinic.AgendaService;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class ClinicBookingPaymentService {

    private final JdbcTemplate jdbc;
    private final AgendaService agenda;
    private final ClinicPaymentAccountService contas;
    private final ClinicCouponService cupons;
    private final MercadoPagoService mercadoPago;

    public ClinicBookingPaymentService(
            JdbcTemplate jdbc,
            AgendaService agenda,
            ClinicPaymentAccountService contas,
            ClinicCouponService cupons,
            MercadoPagoService mercadoPago
    ) {
        this.jdbc = jdbc;
        this.agenda = agenda;
        this.contas = contas;
        this.cupons = cupons;
        this.mercadoPago = mercadoPago;
    }

    public CheckoutView checkout(Integer agendamentoId) {
        AgendaService.Solicitacao item = agenda.detalhe(agendamentoId);
        exigirTutorDono(item);
        BigDecimal bruto = item.valorServico() == null ? BigDecimal.ZERO : item.valorServico();
        BigDecimal desconto = item.valorDesconto() == null ? BigDecimal.ZERO : item.valorDesconto();
        BigDecimal cobrado = item.valorCobrado() == null ? bruto.subtract(desconto) : item.valorCobrado();
        if (cobrado.compareTo(BigDecimal.ZERO) < 0) {
            cobrado = BigDecimal.ZERO;
        }
        ClinicPaymentAccountService.ContaView conta = contas.buscarConectada(item.empresaId());
        return new CheckoutView(
                item.id(),
                item.statusCodigo(),
                item.clinica(),
                item.pet(),
                item.tipo(),
                item.servico() != null ? item.servico() : item.vacina(),
                item.inicio(),
                bruto.setScale(2, RoundingMode.HALF_UP),
                desconto.setScale(2, RoundingMode.HALF_UP),
                cobrado.setScale(2, RoundingMode.HALF_UP),
                item.codigoCupom(),
                conta != null && conta.conectada(),
                conta == null ? null : conta.publicKey(),
                "AGUARDANDO_PAGAMENTO".equals(item.statusCodigo())
        );
    }

    @Transactional
    public CheckoutView aplicarCupom(Integer agendamentoId, String codigo) {
        AgendaService.Solicitacao item = agenda.detalhe(agendamentoId);
        exigirTutorDono(item);
        exigirAguardandoPagamento(item);
        BigDecimal bruto = exigirValorBruto(item);
        ClinicCouponService.CupomRow cupom = cupons.exigirValido(item.empresaId(), codigo);
        BigDecimal desconto = bruto.multiply(cupom.percentual())
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal cobrado = bruto.subtract(desconto).max(BigDecimal.ZERO);
        jdbc.update(
                """
                UPDATE flutz.agendamento
                SET empresa_cupom_id = ?, valor_desconto = ?, valor_cobrado = ?
                WHERE agendamento_id = ?
                """,
                cupom.id(), desconto, cobrado, agendamentoId
        );
        return checkout(agendamentoId);
    }

    @Transactional
    public CheckoutView removerCupom(Integer agendamentoId) {
        AgendaService.Solicitacao item = agenda.detalhe(agendamentoId);
        exigirTutorDono(item);
        exigirAguardandoPagamento(item);
        BigDecimal bruto = exigirValorBruto(item);
        jdbc.update(
                """
                UPDATE flutz.agendamento
                SET empresa_cupom_id = NULL, valor_desconto = 0, valor_cobrado = ?
                WHERE agendamento_id = ?
                """,
                bruto, agendamentoId
        );
        return checkout(agendamentoId);
    }

    public Config config(Integer agendamentoId) {
        AgendaService.Solicitacao item = agenda.detalhe(agendamentoId);
        exigirTutorDono(item);
        ClinicPaymentAccountService.ContaCredenciais conta = contas.exigirCredenciais(item.empresaId());
        return new Config(conta.publicKey());
    }

    @Transactional
    public PaymentResult pagarPix(Integer agendamentoId) {
        AgendaService.Solicitacao item = agenda.detalhe(agendamentoId);
        exigirTutorDono(item);
        exigirAguardandoPagamento(item);
        Valores valores = valoresAtuais(item);
        if (zerado(valores.cobrado())) {
            confirmarSemGateway(item, valores);
            return pago(item, valores, null, null);
        }
        ClinicPaymentAccountService.ContaCredenciais conta = contas.exigirCredenciais(item.empresaId());
        Integer pagamentoId = garantirPagamentoPendente(item, valores, conta.id());
        String providerId = providerId(pagamentoId);
        if (providerId != null) {
            Payment existente = mercadoPago.consultar(providerId, conta.accessToken());
            aplicarStatusMp(item, pagamentoId, valores, existente);
            if (aprovado(existente)) {
                return pago(item, valores, existente, "PIX");
            }
            if (pendente(existente) && qr(existente) != null) {
                return fromPayment(item, valores, existente, "PIX");
            }
        }
        MercadoPagoService.Pagador pagador = pagadorTutor();
        Payment payment = mercadoPago.criarPix(
                valores.cobrado(),
                "Agendamento Flutz — " + item.clinica(),
                "FLUTZ-AGENDAMENTO-" + item.id(),
                pagador,
                conta.accessToken()
        );
        gravarProvider(pagamentoId, payment);
        aplicarStatusMp(item, pagamentoId, valores, payment);
        return fromPayment(item, valores, payment, "PIX");
    }

    @Transactional
    public PaymentResult pagarCartao(Integer agendamentoId, MercadoPagoService.CardPaymentRequest card) {
        AgendaService.Solicitacao item = agenda.detalhe(agendamentoId);
        exigirTutorDono(item);
        exigirAguardandoPagamento(item);
        Valores valores = valoresAtuais(item);
        if (zerado(valores.cobrado())) {
            confirmarSemGateway(item, valores);
            return pago(item, valores, null, null);
        }
        if (card.token() == null || card.token().isBlank() || card.paymentMethodId() == null || card.paymentMethodId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não foi possível tokenizar o cartão. Verifique os dados.");
        }
        ClinicPaymentAccountService.ContaCredenciais conta = contas.exigirCredenciais(item.empresaId());
        Integer pagamentoId = garantirPagamentoPendente(item, valores, conta.id());
        MercadoPagoService.Pagador pagador = pagadorTutor();
        MercadoPagoService.CardPaymentRequest completo = new MercadoPagoService.CardPaymentRequest(
                card.token(),
                card.paymentMethodId(),
                card.installments(),
                card.issuerId(),
                card.payerEmail() == null || card.payerEmail().isBlank() ? pagador.email() : card.payerEmail(),
                card.payerName() == null || card.payerName().isBlank() ? pagador.nome() : card.payerName(),
                card.payerCpf() == null || card.payerCpf().isBlank() ? pagador.cpf() : card.payerCpf()
        );
        Payment payment = mercadoPago.criarCartao(
                valores.cobrado(),
                "Agendamento Flutz — " + item.clinica(),
                "FLUTZ-AGENDAMENTO-" + item.id(),
                completo,
                conta.accessToken()
        );
        gravarProvider(pagamentoId, payment);
        aplicarStatusMp(item, pagamentoId, valores, payment);
        if (!aprovado(payment)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensagemCartao(payment));
        }
        return fromPayment(item, valores, payment, "CREDIT_CARD");
    }

    @Transactional
    public PaymentResult status(Integer agendamentoId) {
        AgendaService.Solicitacao item = agenda.detalhe(agendamentoId);
        exigirTutorDono(item);
        Valores valores = valoresAtuais(item);
        if ("CONFIRMADO".equals(item.statusCodigo()) || "CONCLUIDO".equals(item.statusCodigo())) {
            return pago(item, valores, null, null);
        }
        Integer pagamentoId = pagamentoPendenteId(item.id());
        if (pagamentoId == null) {
            return new PaymentResult(item.id(), valores.cobrado(), item.statusCodigo(), false, null, null, null, null, null);
        }
        String providerId = providerId(pagamentoId);
        if (providerId == null || providerId.isBlank()) {
            return new PaymentResult(item.id(), valores.cobrado(), "PENDENTE", false, null, null, null, null, null);
        }
        ClinicPaymentAccountService.ContaCredenciais conta = contas.exigirCredenciais(item.empresaId());
        Payment payment = mercadoPago.consultar(providerId, conta.accessToken());
        aplicarStatusMp(item, pagamentoId, valores, payment);
        return fromPayment(item, valores, payment, metodo(payment));
    }

    @Transactional
    public void processarWebhookPorDataId(String dataId, Map<String, Object> payload) {
        String id = dataId;
        if ((id == null || id.isBlank()) && payload != null && payload.get("data") instanceof Map<?, ?> data) {
            Object raw = data.get("id");
            id = raw == null ? null : String.valueOf(raw);
        }
        if (id == null || id.isBlank()) {
            return;
        }
        Integer pagamentoId = pagamentoIdPorProvider(id);
        if (pagamentoId == null && payload != null) {
            Object ref = payload.get("external_reference");
            if (ref != null) {
                pagamentoId = pagamentoIdPorReferencia(String.valueOf(ref));
            }
        }
        if (pagamentoId == null) {
            return;
        }
        PagamentoCtx ctx = carregarPagamento(pagamentoId);
        if (ctx == null || ctx.agendamentoId() == null) {
            return;
        }
        ClinicPaymentAccountService.ContaCredenciais conta = contas.exigirCredenciais(ctx.empresaId());
        Payment payment = mercadoPago.consultar(id, conta.accessToken());
        AgendaService.Solicitacao item = agenda.detalheInterno(ctx.agendamentoId());
        Valores valores = valoresAtuais(item);
        aplicarStatusMp(item, pagamentoId, valores, payment);
    }

    @Transactional
    public void processarWebhookPagamento(Payment payment) {
        if (payment == null || payment.getId() == null) {
            return;
        }
        processarWebhookPorDataId(String.valueOf(payment.getId()), Map.of());
    }

    private void aplicarStatusMp(AgendaService.Solicitacao item, Integer pagamentoId, Valores valores, Payment payment) {
        gravarProvider(pagamentoId, payment);
        if (aprovado(payment)) {
            jdbc.update(
                    """
                    UPDATE flutz.pagamento
                    SET status_pagamento = 'PAGO', pago_em = CURRENT_TIMESTAMP, metodo = ?, valor = ?
                    WHERE pagamento_id = ?
                    """,
                    metodo(payment), valores.cobrado(), pagamentoId
            );
            Integer cupomId = jdbc.query(
                    "SELECT empresa_cupom_id FROM flutz.agendamento WHERE agendamento_id = ?",
                    rs -> rs.next() ? (Integer) rs.getObject(1) : null,
                    item.id()
            );
            cupons.registrarUso(cupomId);
            agenda.marcarConfirmadoAposPagamento(item.id());
        } else if (falhou(payment)) {
            jdbc.update(
                    "UPDATE flutz.pagamento SET status_pagamento = 'FALHOU', metodo = ? WHERE pagamento_id = ?",
                    metodo(payment), pagamentoId
            );
        }
    }

    private void confirmarSemGateway(AgendaService.Solicitacao item, Valores valores) {
        ClinicPaymentAccountService.ContaView conta = contas.buscarConectada(item.empresaId());
        Integer contaId = conta == null ? null : conta.id();
        Integer pagamentoId = garantirPagamentoPendente(item, valores, contaId);
        jdbc.update(
                """
                UPDATE flutz.pagamento
                SET status_pagamento = 'PAGO', pago_em = CURRENT_TIMESTAMP, metodo = 'CUPOM', valor = 0
                WHERE pagamento_id = ?
                """,
                pagamentoId
        );
        Integer cupomId = jdbc.query(
                "SELECT empresa_cupom_id FROM flutz.agendamento WHERE agendamento_id = ?",
                rs -> rs.next() ? (Integer) rs.getObject(1) : null,
                item.id()
        );
        cupons.registrarUso(cupomId);
        agenda.marcarConfirmadoAposPagamento(item.id());
    }

    private Integer garantirPagamentoPendente(AgendaService.Solicitacao item, Valores valores, Integer contaId) {
        Integer existente = pagamentoPendenteId(item.id());
        if (existente != null) {
            jdbc.update(
                    """
                    UPDATE flutz.pagamento
                    SET valor = ?, valor_bruto = ?, percentual_desconto = ?, codigo_cupom_aplicado = ?,
                        empresa_cupom_id = ?, conta_pagamento_id = ?, descricao = ?
                    WHERE pagamento_id = ?
                    """,
                    valores.cobrado(),
                    valores.bruto(),
                    valores.percentual(),
                    valores.codigoCupom(),
                    valores.cupomId(),
                    contaId,
                    descricao(item),
                    existente
            );
            return existente;
        }
        return jdbc.queryForObject(
                """
                INSERT INTO flutz.pagamento (
                    empresa_id, conta_pagamento_id, cliente_id, tipo_origem, agendamento_id, empresa_servico_id,
                    valor, valor_bruto, percentual_desconto, codigo_cupom_aplicado, empresa_cupom_id,
                    status_pagamento, provider, descricao
                ) VALUES (?, ?, ?, 'AGENDAMENTO', ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', 'mercadopago', ?)
                RETURNING pagamento_id
                """,
                Integer.class,
                item.empresaId(),
                contaId,
                item.clienteId(),
                item.id(),
                item.empresaServicoId(),
                valores.cobrado(),
                valores.bruto(),
                valores.percentual(),
                valores.codigoCupom(),
                valores.cupomId(),
                descricao(item)
            );
    }

    private void gravarProvider(Integer pagamentoId, Payment payment) {
        if (pagamentoId == null || payment == null || payment.getId() == null) {
            return;
        }
        jdbc.update(
                """
                UPDATE flutz.pagamento
                SET provider = 'mercadopago', provider_pagamento_id = ?
                WHERE pagamento_id = ?
                """,
                String.valueOf(payment.getId()), pagamentoId
        );
    }

    private Integer pagamentoPendenteId(Integer agendamentoId) {
        return jdbc.query(
                """
                SELECT pagamento_id FROM flutz.pagamento
                WHERE agendamento_id = ? AND status_pagamento IN ('PENDENTE', 'FALHOU')
                ORDER BY pagamento_id DESC LIMIT 1
                """,
                rs -> rs.next() ? rs.getInt(1) : null,
                agendamentoId
        );
    }

    private String providerId(Integer pagamentoId) {
        return jdbc.query(
                "SELECT provider_pagamento_id FROM flutz.pagamento WHERE pagamento_id = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                pagamentoId
        );
    }

    private Integer pagamentoIdPorProvider(String providerId) {
        return jdbc.query(
                "SELECT pagamento_id FROM flutz.pagamento WHERE provider = 'mercadopago' AND provider_pagamento_id = ?",
                rs -> rs.next() ? rs.getInt(1) : null,
                providerId
        );
    }

    private Integer pagamentoIdPorReferencia(String ref) {
        if (ref == null || !ref.startsWith("FLUTZ-AGENDAMENTO-")) {
            return null;
        }
        try {
            int agendamentoId = Integer.parseInt(ref.substring("FLUTZ-AGENDAMENTO-".length()));
            return jdbc.query(
                    """
                    SELECT pagamento_id FROM flutz.pagamento
                    WHERE agendamento_id = ?
                    ORDER BY pagamento_id DESC LIMIT 1
                    """,
                    rs -> rs.next() ? rs.getInt(1) : null,
                    agendamentoId
            );
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private PagamentoCtx carregarPagamento(Integer pagamentoId) {
        return jdbc.query(
                "SELECT empresa_id, agendamento_id FROM flutz.pagamento WHERE pagamento_id = ?",
                rs -> rs.next() ? new PagamentoCtx(rs.getInt(1), (Integer) rs.getObject(2)) : null,
                pagamentoId
        );
    }

    private Valores valoresAtuais(AgendaService.Solicitacao item) {
        BigDecimal bruto = item.valorServico() == null ? BigDecimal.ZERO : item.valorServico();
        BigDecimal desconto = item.valorDesconto() == null ? BigDecimal.ZERO : item.valorDesconto();
        BigDecimal cobrado = item.valorCobrado() == null ? bruto.subtract(desconto) : item.valorCobrado();
        if (cobrado.compareTo(BigDecimal.ZERO) < 0) {
            cobrado = BigDecimal.ZERO;
        }
        BigDecimal percentual = BigDecimal.ZERO;
        if (bruto.compareTo(BigDecimal.ZERO) > 0 && desconto.compareTo(BigDecimal.ZERO) > 0) {
            percentual = desconto.multiply(new BigDecimal("100")).divide(bruto, 2, RoundingMode.HALF_UP);
        }
        Integer cupomId = jdbc.query(
                "SELECT empresa_cupom_id FROM flutz.agendamento WHERE agendamento_id = ?",
                rs -> rs.next() ? (Integer) rs.getObject(1) : null,
                item.id()
        );
        return new Valores(
                bruto.setScale(2, RoundingMode.HALF_UP),
                desconto.setScale(2, RoundingMode.HALF_UP),
                cobrado.setScale(2, RoundingMode.HALF_UP),
                percentual,
                item.codigoCupom(),
                cupomId
        );
    }

    private BigDecimal exigirValorBruto(AgendaService.Solicitacao item) {
        if (item.valorServico() == null || item.valorServico().compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este agendamento não tem preço definido");
        }
        return item.valorServico().setScale(2, RoundingMode.HALF_UP);
    }

    private MercadoPagoService.Pagador pagadorTutor() {
        AuthPrincipal auth = AuthHolder.current();
        return jdbc.query(
                "SELECT nome_cliente, email, cpf FROM flutz.cliente WHERE cliente_id = ?",
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tutor não encontrado");
                    }
                    return new MercadoPagoService.Pagador(rs.getString(1), rs.getString(2), rs.getString(3));
                },
                auth.atorId()
        );
    }

    private void exigirTutorDono(AgendaService.Solicitacao item) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor() || !item.clienteId().equals(auth.atorId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor deste agendamento pode pagar");
        }
    }

    private void exigirAguardandoPagamento(AgendaService.Solicitacao item) {
        if (!"AGUARDANDO_PAGAMENTO".equals(item.statusCodigo())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este agendamento não está aguardando pagamento");
        }
    }

    private static boolean zerado(BigDecimal valor) {
        return valor == null || valor.compareTo(BigDecimal.ZERO) <= 0;
    }

    private static boolean aprovado(Payment payment) {
        return payment != null && "approved".equalsIgnoreCase(payment.getStatus());
    }

    private static boolean pendente(Payment payment) {
        return payment != null && ("pending".equalsIgnoreCase(payment.getStatus()) || "in_process".equalsIgnoreCase(payment.getStatus()));
    }

    private static boolean falhou(Payment payment) {
        return payment != null && ("rejected".equalsIgnoreCase(payment.getStatus()) || "cancelled".equalsIgnoreCase(payment.getStatus()));
    }

    private static String metodo(Payment payment) {
        if (payment == null || payment.getPaymentMethodId() == null) {
            return null;
        }
        return payment.getPaymentMethodId().toUpperCase(Locale.ROOT);
    }

    private static PixQr qr(Payment payment) {
        if (payment == null || payment.getPointOfInteraction() == null
                || payment.getPointOfInteraction().getTransactionData() == null) {
            return null;
        }
        var data = payment.getPointOfInteraction().getTransactionData();
        return new PixQr(data.getQrCode(), data.getQrCodeBase64());
    }

    private static String mensagemCartao(Payment payment) {
        if (payment == null || payment.getStatusDetail() == null) {
            return "Pagamento não aprovado. Tente outro cartão ou PIX.";
        }
        return "Pagamento não aprovado (" + payment.getStatusDetail() + ").";
    }

    private static String descricao(AgendaService.Solicitacao item) {
        String alvo = item.servico() != null ? item.servico() : item.vacina();
        return "Agendamento #" + item.id() + (alvo == null ? "" : " — " + alvo);
    }

    private PaymentResult pago(AgendaService.Solicitacao item, Valores valores, Payment payment, String metodo) {
        return new PaymentResult(
                item.id(),
                valores.cobrado(),
                "CONFIRMADO",
                true,
                payment == null ? null : String.valueOf(payment.getId()),
                metodo,
                null,
                null,
                null
        );
    }

    private PaymentResult fromPayment(AgendaService.Solicitacao item, Valores valores, Payment payment, String metodo) {
        PixQr qr = qr(payment);
        boolean ok = aprovado(payment);
        return new PaymentResult(
                item.id(),
                valores.cobrado(),
                ok ? "CONFIRMADO" : (payment.getStatus() == null ? "PENDENTE" : payment.getStatus().toUpperCase(Locale.ROOT)),
                ok,
                payment.getId() == null ? null : String.valueOf(payment.getId()),
                metodo,
                qr == null ? null : qr.codigo(),
                qr == null ? null : qr.base64(),
                payment.getStatusDetail()
        );
    }

    public record CheckoutView(
            Integer agendamentoId,
            String statusCodigo,
            String clinica,
            String pet,
            String tipo,
            String item,
            String inicio,
            BigDecimal valorServico,
            BigDecimal valorDesconto,
            BigDecimal valorCobrado,
            String codigoCupom,
            boolean contaRecebimentoOk,
            String publicKey,
            boolean podePagar
    ) {
    }

    public record Config(String publicKey) {
    }

    public record PaymentResult(
            Integer agendamentoId,
            BigDecimal valor,
            String status,
            boolean pago,
            String mercadopagoPaymentId,
            String metodo,
            String pixCopiaECola,
            String pixQrCodeBase64,
            String detalhe
    ) {
    }

    private record Valores(
            BigDecimal bruto, BigDecimal desconto, BigDecimal cobrado, BigDecimal percentual,
            String codigoCupom, Integer cupomId
    ) {
    }

    private record PixQr(String codigo, String base64) {
    }

    private record PagamentoCtx(Integer empresaId, Integer agendamentoId) {
    }
}
