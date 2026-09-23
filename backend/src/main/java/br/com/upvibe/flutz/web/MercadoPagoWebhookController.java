package br.com.upvibe.flutz.web;

import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.billing.ClinicBookingPaymentService;
import br.com.upvibe.flutz.billing.MercadoPagoOAuthService;
import br.com.upvibe.flutz.billing.MercadoPagoWebhookValidator;
import br.com.upvibe.flutz.billing.SubscriptionPaymentService;

@RestController
@RequestMapping("/api/public/mercadopago")
public class MercadoPagoWebhookController {

    private final SubscriptionPaymentService payments;
    private final ClinicBookingPaymentService bookingPayments;
    private final MercadoPagoOAuthService oauth;
    private final MercadoPagoWebhookValidator webhookValidator;

    public MercadoPagoWebhookController(
            SubscriptionPaymentService payments,
            ClinicBookingPaymentService bookingPayments,
            MercadoPagoOAuthService oauth,
            MercadoPagoWebhookValidator webhookValidator
    ) {
        this.payments = payments;
        this.bookingPayments = bookingPayments;
        this.oauth = oauth;
        this.webhookValidator = webhookValidator;
    }

    @PostMapping("/webhook")
    public void webhook(
            @RequestBody(required = false) Map<String, Object> payload,
            @RequestHeader(value = "x-signature", required = false) String xSignature,
            @RequestHeader(value = "x-request-id", required = false) String xRequestId,
            @RequestParam(value = "data.id", required = false) String dataId
    ) {
        Map<String, Object> body = payload == null ? Map.of() : payload;
        String resolvedId = dataId;
        if ((resolvedId == null || resolvedId.isBlank()) && body.get("data") instanceof Map<?, ?> data) {
            Object raw = data.get("id");
            resolvedId = raw == null ? null : String.valueOf(raw);
        }
        // Valida uma vez — assinatura e agendamento usam o mesmo endpoint.
        webhookValidator.validar(xSignature, xRequestId, resolvedId);
        try {
            payments.webhook(body, xSignature, xRequestId, dataId);
        } catch (Exception ignored) {
            // Pode ser pagamento de agendamento da clínica, não de assinatura.
        }
        try {
            bookingPayments.processarWebhookPorDataId(dataId, body);
        } catch (Exception ignored) {
            // Sem match de agendamento — ignora.
        }
    }

    @GetMapping("/oauth/callback")
    public ResponseEntity<Void> oauthCallback(
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "error", required = false) String error,
            @RequestParam(value = "error_description", required = false) String errorDescription
    ) {
        MercadoPagoOAuthService.CallbackResult result = oauth.processarCallback(code, state, error, errorDescription);
        if (result.skipRedirect()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, result.redirectUrl())
                .build();
    }
}
