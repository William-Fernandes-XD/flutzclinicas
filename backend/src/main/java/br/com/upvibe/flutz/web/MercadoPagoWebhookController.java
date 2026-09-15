package br.com.upvibe.flutz.web;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.billing.ClinicBookingPaymentService;
import br.com.upvibe.flutz.billing.SubscriptionPaymentService;

@RestController
@RequestMapping("/api/public/mercadopago")
public class MercadoPagoWebhookController {

    private final SubscriptionPaymentService payments;
    private final ClinicBookingPaymentService bookingPayments;

    public MercadoPagoWebhookController(
            SubscriptionPaymentService payments,
            ClinicBookingPaymentService bookingPayments
    ) {
        this.payments = payments;
        this.bookingPayments = bookingPayments;
    }

    @PostMapping("/webhook")
    public void webhook(
            @RequestBody(required = false) Map<String, Object> payload,
            @RequestHeader(value = "x-signature", required = false) String xSignature,
            @RequestHeader(value = "x-request-id", required = false) String xRequestId,
            @RequestParam(value = "data.id", required = false) String dataId
    ) {
        Map<String, Object> body = payload == null ? Map.of() : payload;
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
}
