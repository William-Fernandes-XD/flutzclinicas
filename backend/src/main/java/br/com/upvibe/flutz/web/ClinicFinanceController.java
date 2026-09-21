package br.com.upvibe.flutz.web;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.billing.ClinicBookingPaymentService;
import br.com.upvibe.flutz.billing.ClinicCouponService;
import br.com.upvibe.flutz.billing.ClinicPaymentAccountService;
import br.com.upvibe.flutz.billing.MercadoPagoOAuthService;
import br.com.upvibe.flutz.billing.MercadoPagoService;
import br.com.upvibe.flutz.security.AuthHolder;

@RestController
@RequestMapping("/api")
public class ClinicFinanceController {

    private final ClinicPaymentAccountService contas;
    private final ClinicCouponService cupons;
    private final ClinicBookingPaymentService pagamentos;
    private final MercadoPagoOAuthService oauth;

    public ClinicFinanceController(
            ClinicPaymentAccountService contas,
            ClinicCouponService cupons,
            ClinicBookingPaymentService pagamentos,
            MercadoPagoOAuthService oauth
    ) {
        this.contas = contas;
        this.cupons = cupons;
        this.pagamentos = pagamentos;
        this.oauth = oauth;
    }

    @GetMapping("/clinica/recebimento")
    public ClinicPaymentAccountService.ContaView recebimento() {
        AuthHolder.current();
        return contas.atual();
    }

    @GetMapping("/clinica/recebimento/mercadopago/connect")
    public MercadoPagoOAuthService.ConnectStart conectarMercadoPago() {
        AuthHolder.current();
        return oauth.iniciarConexao();
    }

    @PostMapping("/clinica/recebimento/desconectar")
    public ClinicPaymentAccountService.ContaView desconectarRecebimento() {
        return contas.desconectar();
    }

    @GetMapping("/clinica/recebimentos")
    public List<ClinicPaymentAccountService.RecebimentoResumo> extrato() {
        return contas.extrato();
    }

    @GetMapping("/clinica/cupons")
    public List<ClinicCouponService.Cupom> cupons() {
        return cupons.listar();
    }

    @PostMapping("/clinica/cupons")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicCouponService.Cupom criarCupom(@RequestBody ClinicCouponService.NovoCupom body) {
        return cupons.criar(body);
    }

    @PostMapping("/clinica/cupons/{id}/desativar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativarCupom(@PathVariable Integer id) {
        cupons.desativar(id);
    }

    @GetMapping("/agenda/solicitacoes/{id}/checkout")
    public ClinicBookingPaymentService.CheckoutView checkout(@PathVariable Integer id) {
        return pagamentos.checkout(id);
    }

    @PostMapping("/agenda/solicitacoes/{id}/cupom")
    public ClinicBookingPaymentService.CheckoutView aplicarCupom(
            @PathVariable Integer id,
            @RequestBody Map<String, String> body
    ) {
        return pagamentos.aplicarCupom(id, body == null ? null : body.get("codigo"));
    }

    @PostMapping("/agenda/solicitacoes/{id}/cupom/remover")
    public ClinicBookingPaymentService.CheckoutView removerCupom(@PathVariable Integer id) {
        return pagamentos.removerCupom(id);
    }

    @GetMapping("/agenda/solicitacoes/{id}/pagamento/config")
    public ClinicBookingPaymentService.Config configPagamento(@PathVariable Integer id) {
        return pagamentos.config(id);
    }

    @PostMapping("/agenda/solicitacoes/{id}/pagar/pix")
    public ClinicBookingPaymentService.PaymentResult pagarPix(@PathVariable Integer id) {
        return pagamentos.pagarPix(id);
    }

    @PostMapping("/agenda/solicitacoes/{id}/pagar/cartao")
    public ClinicBookingPaymentService.PaymentResult pagarCartao(
            @PathVariable Integer id,
            @RequestBody MercadoPagoService.CardPaymentRequest body
    ) {
        return pagamentos.pagarCartao(id, body);
    }

    @GetMapping("/agenda/solicitacoes/{id}/pagamento")
    public ClinicBookingPaymentService.PaymentResult statusPagamento(@PathVariable Integer id) {
        return pagamentos.status(id);
    }

    public record PrecoVacinaReq(BigDecimal preco) {
    }
}
