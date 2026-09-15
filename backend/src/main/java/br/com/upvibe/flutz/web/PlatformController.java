package br.com.upvibe.flutz.web;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.billing.TokenBillingService;
import br.com.upvibe.flutz.platform.PlatformService;

@RestController
@RequestMapping("/api/admin")
public class PlatformController {

    private final PlatformService platform;
    private final TokenBillingService billing;

    public PlatformController(PlatformService platform, TokenBillingService billing) {
        this.platform = platform;
        this.billing = billing;
    }

    @GetMapping("/indicadores")
    public PlatformService.IndicadoresResponse indicadores(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate
    ) {
        return platform.indicadores(de, ate);
    }

    @GetMapping("/clinicas")
    public List<PlatformService.ClinicaAdmin> clinicas(@RequestParam(required = false) String q) {
        return platform.clinicas(q);
    }

    @PostMapping("/clinicas/{id}/status")
    public PlatformService.ClinicaAdmin statusClinica(
            @PathVariable Integer id,
            @RequestBody StatusBody body
    ) {
        return platform.atualizarStatusClinica(id, body == null ? null : body.status());
    }

    @GetMapping("/assinaturas")
    public List<PlatformService.AssinaturaAdmin> assinaturas(@RequestParam(required = false) String status) {
        return platform.assinaturas(status);
    }

    @GetMapping("/faturas")
    public List<PlatformService.FaturaAdmin> faturas() {
        return platform.faturas();
    }

    @GetMapping("/usuarios")
    public PlatformService.UsuariosAdmin usuarios() {
        return platform.usuarios();
    }

    @PostMapping("/usuarios/{tipo}/{id}/status")
    public PlatformService.Pessoa statusUsuario(
            @PathVariable String tipo,
            @PathVariable Integer id,
            @RequestBody StatusBody body
    ) {
        return platform.atualizarStatusUsuario(tipo, id, body == null ? null : body.status());
    }

    @GetMapping("/avaliacoes")
    public List<PlatformService.AvaliacaoAdmin> avaliacoes() {
        return platform.avaliacoes();
    }

    @PostMapping("/avaliacoes/{id}/visibilidade")
    public PlatformService.AvaliacaoAdmin visibilidadeAvaliacao(
            @PathVariable Integer id,
            @RequestBody VisibilidadeBody body
    ) {
        return platform.atualizarVisibilidadeAvaliacao(id, body != null && body.visivel());
    }

    @DeleteMapping("/avaliacoes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluirAvaliacao(@PathVariable Integer id) {
        platform.excluirAvaliacao(id);
    }

    @GetMapping("/catalogos/{tipo}")
    public List<PlatformService.Item> catalogo(@PathVariable String tipo) {
        return platform.listarCatalogo(tipo);
    }

    @PostMapping("/catalogos/{tipo}")
    @ResponseStatus(HttpStatus.CREATED)
    public PlatformService.Item criar(
            @PathVariable String tipo,
            @RequestBody NovoItem body
    ) {
        return platform.criarCatalogo(tipo, body.nome(), body.especieId());
    }

    @GetMapping("/tokens")
    public TokenBillingService.PaginaTokens tokens(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return billing.listar(page, size);
    }

    @PostMapping("/tokens")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenBillingService.TokenAdmin criarToken(@RequestBody TokenBillingService.NovoToken body) {
        return billing.criar(body);
    }

    @PostMapping("/tokens/{id}/desativar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativarToken(@PathVariable Integer id) {
        billing.desativar(id);
    }

    public record NovoItem(String nome, Integer especieId) {
    }

    public record StatusBody(String status) {
    }

    public record VisibilidadeBody(boolean visivel) {
    }
}
