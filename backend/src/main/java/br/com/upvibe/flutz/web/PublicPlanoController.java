package br.com.upvibe.flutz.web;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.billing.TokenBillingService;
import br.com.upvibe.flutz.domain.Plano;
import br.com.upvibe.flutz.domain.PlanoRepository;

@RestController
@RequestMapping("/api/public")
public class PublicPlanoController {

    private final PlanoRepository planos;
    private final TokenBillingService billing;

    public PublicPlanoController(PlanoRepository planos, TokenBillingService billing) {
        this.planos = planos;
        this.billing = billing;
    }

    @GetMapping("/planos")
    public List<PlanoResponse> listar() {
        return planos.findByAtivoTrueOrderByValorMensalAsc().stream()
                .map(PlanoResponse::from)
                .toList();
    }

    @PostMapping("/tokens/validar")
    public TokenBillingService.Preview validarToken(@RequestBody ValidarTokenRequest body) {
        return billing.validarPublico(body.codigo(), body.codigoPlano());
    }

    public record ValidarTokenRequest(String codigo, String codigoPlano) {
    }

    public record PlanoResponse(
            String codigo,
            String nome,
            String descricao,
            BigDecimal valorMensal,
            String moeda,
            boolean permitePaginaPublica,
            boolean permiteDoacoes,
            boolean permitePagamentos
    ) {
        static PlanoResponse from(Plano plano) {
            return new PlanoResponse(
                    plano.getCodigo(),
                    plano.getNome(),
                    plano.getDescricao(),
                    plano.getValorMensal(),
                    plano.getMoeda(),
                    plano.isPermitePaginaPublica(),
                    plano.isPermiteDoacoes(),
                    plano.isPermitePagamentos()
            );
        }
    }
}
