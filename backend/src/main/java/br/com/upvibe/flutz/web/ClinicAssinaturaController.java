package br.com.upvibe.flutz.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.billing.AssinaturaAccessService;
import br.com.upvibe.flutz.billing.MercadoPagoService;
import br.com.upvibe.flutz.billing.SubscriptionPaymentService;
import br.com.upvibe.flutz.billing.TokenBillingService;
import br.com.upvibe.flutz.security.AuthHolder;

@RestController
@RequestMapping("/api/assinatura")
public class ClinicAssinaturaController {

    private final TokenBillingService billing;
    private final SubscriptionPaymentService payments;
    private final AssinaturaAccessService access;

    public ClinicAssinaturaController(
            TokenBillingService billing,
            SubscriptionPaymentService payments,
            AssinaturaAccessService access
    ) {
        this.billing = billing;
        this.payments = payments;
        this.access = access;
    }

    @GetMapping("/mensalidade")
    public TokenBillingService.Mensalidade mensalidade() {
        return billing.mensalidadeClinica();
    }

    @GetMapping("/acesso")
    public AssinaturaAccessService.Acesso acesso() {
        return access.acesso(AuthHolder.current().empresaId());
    }

    @PostMapping("/token")
    public TokenBillingService.Mensalidade aplicarToken(@RequestBody CodigoTokenRequest body) {
        return billing.aplicarTokenClinica(body.codigo());
    }

    @GetMapping("/pagamento/config")
    public SubscriptionPaymentService.Config pagamentoConfig() {
        return payments.config();
    }

    @PostMapping("/pagar/pix")
    public SubscriptionPaymentService.PaymentResult pagarPix(@RequestBody(required = false) MercadoPagoService.DevicePayload body) {
        return payments.pagarPix(body);
    }

    @PostMapping("/pagar/cartao")
    public SubscriptionPaymentService.PaymentResult pagarCartao(@RequestBody MercadoPagoService.CardPaymentRequest body) {
        return payments.pagarCartao(body);
    }

    @GetMapping("/pagamento")
    public SubscriptionPaymentService.PaymentResult statusPagamento() {
        return payments.status();
    }

    public record CodigoTokenRequest(String codigo) {
    }
}
