package br.com.upvibe.flutz.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.clinic.ClinicCatalogService;
import br.com.upvibe.flutz.security.AuthHolder;

@RestController
@RequestMapping("/api/catalogos")
public class CatalogController {

    private final ClinicCatalogService catalogos;

    public CatalogController(ClinicCatalogService catalogos) {
        this.catalogos = catalogos;
    }

    @GetMapping("/especies")
    public List<ClinicCatalogService.Item> especies(@RequestParam(required = false) Integer empresaId) {
        AuthHolder.current();
        return catalogos.listar("especies", empresaId);
    }

    @GetMapping("/racas")
    public List<ClinicCatalogService.Item> racas(
            @RequestParam(required = false) Integer especieId,
            @RequestParam(required = false) Integer empresaId
    ) {
        AuthHolder.current();
        return catalogos.racasPorEspecie(especieId, empresaId);
    }

    @GetMapping("/tipos-servico")
    public List<ClinicCatalogService.Item> tipos() {
        AuthHolder.current();
        return catalogos.listar("tipos-servico", null);
    }

    @GetMapping("/vacinas")
    public List<ClinicCatalogService.Item> vacinas() {
        AuthHolder.current();
        return catalogos.listar("vacinas", null);
    }

    @GetMapping("/doencas")
    public List<ClinicCatalogService.Item> doencas() {
        AuthHolder.current();
        return catalogos.listar("doencas", null);
    }

    @GetMapping("/especialidades-globais")
    public List<ClinicCatalogService.Item> especialidades() {
        AuthHolder.current();
        return catalogos.listar("especialidades", null);
    }

    @GetMapping("/chat-motivos")
    public List<ClinicCatalogService.Item> motivos() {
        return catalogos.motivosChat();
    }

    @GetMapping("/papeis")
    public List<ClinicCatalogService.Item> papeis() {
        AuthHolder.current();
        return catalogos.listar("papeis", null);
    }
}
