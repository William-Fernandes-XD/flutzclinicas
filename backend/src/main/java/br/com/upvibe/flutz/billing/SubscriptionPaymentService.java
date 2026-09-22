package br.com.upvibe.flutz.billing;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.mercadopago.resources.payment.Payment;

import br.com.upvibe.flutz.clinic.ClinicService;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class SubscriptionPaymentService {

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;
    private final TokenBillingService billing;
    private final MercadoPagoService mercadoPago;
    private final MercadoPagoWebhookValidator webhook;

    public SubscriptionPaymentService(
            JdbcTemplate jdbc,
            ClinicService clinic,
            TokenBillingService billing,
            MercadoPagoService mercadoPago,
            MercadoPagoWebhookValidator webhook
    ) {
        this.jdbc = jdbc;
        this.clinic = clinic;
        this.billing = billing;
        this.mercadoPago = mercadoPago;
        this.webhook = webhook;
    }

    public Config config() {
        AuthHolder.current();
        return new Config(mercadoPago.publicKey());
    }

    @Transactional
    public PaymentResult pagarPix(MercadoPagoService.DevicePayload body) {
        FaturaAberta fatura = exigirFaturaAberta();
        if (zerada(fatura.valor())) {
            billing.marcarFaturaPaga(fatura.id(), "pix", null);
            return pago(fatura, null);
        }
        MercadoPagoService.Pagador pagador = pagadorAtual(body == null ? null : body.deviceId());
        if (fatura.pagamentoId() != null && !fatura.pagamentoId().isBlank()) {
            try {
                Payment existente = mercadoPago.consultar(fatura.pagamentoId());
                aplicarStatus(fatura.id(), existente);
                if (aprovado(existente)) {
                    return pago(fatura, existente);
                }
                if (pendente(existente) && qr(existente) != null) {
                    return fromPayment(fatura, existente, "PIX");
                }
            } catch (ResponseStatusException ex) {
                // Pagamento antigo (ex.: de produção) some após troca de credenciais — gera um novo.
                billing.gravarPagamentoProvider(fatura.id(), "pix", null);
            }
        }
        Payment payment = mercadoPago.criarPix(
                fatura.valor(),
                "Mensalidade Flutz — " + fatura.plano(),
                "FLUTZ-FATURA-" + fatura.id(),
                pagador
        );
        billing.gravarPagamentoProvider(fatura.id(), "pix", String.valueOf(payment.getId()));
        aplicarStatus(fatura.id(), payment);
        return fromPayment(fatura, payment, "PIX");
    }

    @Transactional
    public PaymentResult pagarCartao(MercadoPagoService.CardPaymentRequest card) {
        FaturaAberta fatura = exigirFaturaAberta();
        if (zerada(fatura.valor())) {
            billing.marcarFaturaPaga(fatura.id(), "cartao", null);
            return pago(fatura, null);
        }
        if (card.token() == null || card.token().isBlank() || card.paymentMethodId() == null || card.paymentMethodId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não foi possível tokenizar o cartão. Verifique os dados.");
        }
        MercadoPagoService.Pagador pagador = pagadorAtual(card.deviceId());
        MercadoPagoService.CardPaymentRequest completo = new MercadoPagoService.CardPaymentRequest(
                card.token(),
                card.paymentMethodId(),
                card.installments(),
                card.issuerId(),
                card.payerEmail() == null || card.payerEmail().isBlank() ? pagador.email() : card.payerEmail(),
                card.payerName() == null || card.payerName().isBlank() ? pagador.nome() : card.payerName(),
                card.payerCpf() == null || card.payerCpf().isBlank() ? pagador.cpf() : card.payerCpf(),
                card.deviceId() == null || card.deviceId().isBlank() ? pagador.deviceId() : card.deviceId(),
                pagador.registrationDate()
        );
        Payment payment = mercadoPago.criarCartao(
                fatura.valor(),
                "Mensalidade Flutz — " + fatura.plano(),
                "FLUTZ-FATURA-" + fatura.id(),
                completo
        );
        billing.gravarPagamentoProvider(fatura.id(), "cartao", String.valueOf(payment.getId()));
        aplicarStatus(fatura.id(), payment);
        if (!aprovado(payment)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensagemCartao(payment));
        }
        return fromPayment(fatura, payment, "CREDIT_CARD");
    }

    @Transactional
    public PaymentResult status() {
        exigirClinicaAdmin();
        Integer empresaId = clinic.empresaAtual().getId();
        FaturaAberta fatura = jdbc.query(
                """
                SELECT f.fatura_assinatura_id, f.valor, f.status_fatura, f.provider_pagamento_id, p.nome
                FROM flutz.fatura_assinatura f
                JOIN flutz.assinatura a ON a.assinatura_id = f.assinatura_id
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                WHERE f.empresa_id = ?
                ORDER BY f.fatura_assinatura_id DESC
                LIMIT 1
                """,
                rs -> rs.next()
                        ? new FaturaAberta(
                                rs.getInt(1),
                                rs.getBigDecimal(2),
                                rs.getString(3),
                                rs.getString(4),
                                rs.getString(5)
                        )
                        : null,
                empresaId
        );
        if (fatura == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não há fatura para consultar");
        }
        if ("PAGA".equals(fatura.status())) {
            return pago(fatura, null);
        }
        if (fatura.pagamentoId() == null || fatura.pagamentoId().isBlank()) {
            return new PaymentResult(fatura.id(), fatura.valor(), fatura.status(), false, null, null, null, null, null);
        }
        try {
            Payment payment = mercadoPago.consultar(fatura.pagamentoId());
            aplicarStatus(fatura.id(), payment);
            return fromPayment(fatura, payment, metodo(payment));
        } catch (ResponseStatusException ex) {
            billing.gravarPagamentoProvider(fatura.id(), null, null);
            return new PaymentResult(fatura.id(), fatura.valor(), fatura.status(), false, null, null, null, null, null);
        }
    }

    @Transactional
    public void webhook(Map<String, Object> payload, String xSignature, String xRequestId, String dataIdQuery) {
        String dataId = dataId(dataIdQuery, payload);
        webhook.validar(xSignature, xRequestId, dataId);
        if (dataId == null || dataId.isBlank()) {
            return;
        }
        Payment payment = mercadoPago.consultar(dataId);
        Integer faturaId = billing.faturaIdPorPagamentoProvider(String.valueOf(payment.getId()));
        if (faturaId == null) {
            faturaId = billing.faturaIdPorReferencia(payment.getExternalReference());
        }
        if (faturaId == null) {
            return;
        }
        billing.gravarPagamentoProvider(faturaId, "mercadopago", String.valueOf(payment.getId()));
        aplicarStatus(faturaId, payment);
    }

    private void aplicarStatus(Integer faturaId, Payment payment) {
        if (aprovado(payment)) {
            billing.marcarFaturaPaga(faturaId, "mercadopago", String.valueOf(payment.getId()));
        }
    }

    private FaturaAberta exigirFaturaAberta() {
        exigirClinicaAdmin();
        billing.mensalidadeClinica();
        Integer empresaId = clinic.empresaAtual().getId();
        FaturaAberta fatura = jdbc.query(
                """
                SELECT f.fatura_assinatura_id, f.valor, f.status_fatura, f.provider_pagamento_id, p.nome
                FROM flutz.fatura_assinatura f
                JOIN flutz.assinatura a ON a.assinatura_id = f.assinatura_id
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                WHERE f.empresa_id = ? AND f.status_fatura IN ('PENDENTE', 'ATRASADA')
                ORDER BY f.data_vencimento ASC, f.fatura_assinatura_id ASC
                LIMIT 1
                """,
                rs -> rs.next()
                        ? new FaturaAberta(
                                rs.getInt(1),
                                rs.getBigDecimal(2),
                                rs.getString(3),
                                rs.getString(4),
                                rs.getString(5)
                        )
                        : null,
                empresaId
        );
        if (fatura == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não há fatura em aberto para pagar");
        }
        return fatura;
    }

    private MercadoPagoService.Pagador pagadorAtual(String deviceId) {
        AuthPrincipal auth = AuthHolder.current();
        return jdbc.query(
                """
                SELECT c.nome_colaborador, c.email, c.cpf, c.data_criacao, e.data_criacao AS empresa_criacao
                FROM flutz.colaborador c
                JOIN flutz.empresa e ON e.empresa_id = c.empresa_id
                WHERE c.colaborador_id = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um CPF válido para pagar");
                    }
                    java.sql.Timestamp cadastro = rs.getTimestamp("data_criacao");
                    if (cadastro == null) {
                        cadastro = rs.getTimestamp("empresa_criacao");
                    }
                    java.time.OffsetDateTime registration = cadastro == null
                            ? null
                            : cadastro.toInstant().atOffset(java.time.ZoneOffset.UTC);
                    return new MercadoPagoService.Pagador(
                            rs.getString("nome_colaborador"),
                            rs.getString("email"),
                            rs.getString("cpf"),
                            deviceId,
                            registration
                    );
                },
                auth.atorId()
        );
    }

    private void exigirClinicaAdmin() {
        AuthPrincipal auth = AuthHolder.current();
        if (!(auth.temPapel("administrador") || auth.adminPlataforma())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica");
        }
        clinic.empresaAtual();
    }

    private PaymentResult pago(FaturaAberta fatura, Payment payment) {
        return new PaymentResult(
                fatura.id(),
                fatura.valor(),
                "PAGA",
                true,
                payment == null ? null : String.valueOf(payment.getId()),
                payment == null ? null : metodo(payment),
                null,
                null,
                null
        );
    }

    private PaymentResult fromPayment(FaturaAberta fatura, Payment payment, String metodo) {
        PixQr qr = qr(payment);
        return new PaymentResult(
                fatura.id(),
                fatura.valor(),
                payment.getStatus(),
                aprovado(payment),
                String.valueOf(payment.getId()),
                metodo,
                qr == null ? null : qr.code(),
                qr == null ? null : qr.base64(),
                qr == null ? null : LocalDateTime.now().plusMinutes(30).toString()
        );
    }

    private static PixQr qr(Payment payment) {
        if (payment.getPointOfInteraction() == null || payment.getPointOfInteraction().getTransactionData() == null) {
            return null;
        }
        var data = payment.getPointOfInteraction().getTransactionData();
        if (data.getQrCode() == null && data.getQrCodeBase64() == null) {
            return null;
        }
        return new PixQr(data.getQrCode(), data.getQrCodeBase64());
    }

    private static boolean aprovado(Payment payment) {
        return payment.getStatus() != null && "approved".equalsIgnoreCase(payment.getStatus());
    }

    private static boolean pendente(Payment payment) {
        String status = payment.getStatus() == null ? "" : payment.getStatus().toLowerCase();
        return "pending".equals(status) || "in_process".equals(status) || "authorized".equals(status);
    }

    private static boolean zerada(BigDecimal valor) {
        return valor == null || valor.compareTo(BigDecimal.ZERO) <= 0;
    }

    private static String metodo(Payment payment) {
        if (payment.getPaymentMethodId() != null && "pix".equalsIgnoreCase(payment.getPaymentMethodId())) {
            return "PIX";
        }
        return "CREDIT_CARD";
    }

    private static String mensagemCartao(Payment payment) {
        String status = payment.getStatus() == null ? "" : payment.getStatus();
        String detail = payment.getStatusDetail() == null ? "" : payment.getStatusDetail().trim();
        if (detail.isBlank()) {
            return "Pagamento não aprovado (" + status + "). Use cartão de teste com titular APRO e credenciais de teste no .env.";
        }
        return switch (detail) {
            case "cc_rejected_bad_filled_security_code" -> "CVV inválido.";
            case "cc_rejected_bad_filled_date" -> "Data de validade inválida.";
            case "cc_rejected_bad_filled_card_number" -> "Número do cartão inválido.";
            case "cc_rejected_insufficient_amount" -> "Saldo insuficiente (simulado).";
            case "cc_rejected_other_reason", "cc_rejected_call_for_authorize", "cc_rejected_card_disabled",
                 "cc_rejected_high_risk", "cc_rejected_blacklist" ->
                    "Cartão recusado (" + detail + "). Com credenciais de produção, cartão de teste não funciona — use credenciais de teste e titular APRO.";
            default -> "Pagamento não aprovado (" + detail + ").";
        };
    }

    @SuppressWarnings("unchecked")
    private static String dataId(String query, Map<String, Object> payload) {
        if (query != null && !query.isBlank()) {
            return query;
        }
        Object data = payload == null ? null : payload.get("data");
        if (data instanceof Map<?, ?> map && map.get("id") != null) {
            return map.get("id").toString();
        }
        return null;
    }

    public record Config(String publicKey) {
    }

    public record PaymentResult(
            Integer faturaId,
            BigDecimal amount,
            String status,
            boolean paid,
            String mercadopagoPaymentId,
            String method,
            String pixQrCode,
            String pixQrCodeBase64,
            String pixExpiration
    ) {
    }

    private record FaturaAberta(Integer id, BigDecimal valor, String status, String pagamentoId, String plano) {
    }

    private record PixQr(String code, String base64) {
    }
}
