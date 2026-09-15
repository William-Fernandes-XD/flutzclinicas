package br.com.upvibe.flutz.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.clinic.ClinicCatalogService;

@RestController
@RequestMapping("/api")
public class ClinicCatalogController {

    private final ClinicCatalogService catalogos;

    public ClinicCatalogController(ClinicCatalogService catalogos) {
        this.catalogos = catalogos;
    }

    @GetMapping("/clinica/catalogos/{tipo}")
    public List<ClinicCatalogService.Item> listar(
            @PathVariable String tipo,
            @RequestParam(required = false) Integer empresaId,
            @RequestParam(required = false) Integer especieId
    ) {
        if ("racas".equalsIgnoreCase(tipo) && especieId != null) {
            return catalogos.racasPorEspecie(especieId, empresaId);
        }
        return catalogos.listarGestao(tipo, empresaId);
    }

    @PostMapping("/clinica/catalogos/{tipo}")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicCatalogService.Item criar(@PathVariable String tipo, @RequestBody NovoItem body) {
        return catalogos.criar(tipo, body.nome(), body.especieId(), body.icone());
    }

    @PutMapping("/clinica/catalogos/{tipo}/{id}")
    public ClinicCatalogService.Item atualizar(
            @PathVariable String tipo,
            @PathVariable Integer id,
            @RequestBody NovoItem body
    ) {
        return catalogos.atualizar(tipo, id, body.nome(), body.icone());
    }

    @PostMapping("/clinica/catalogos/{tipo}/{id}/ativo")
    public ClinicCatalogService.Item definirAtivo(
            @PathVariable String tipo,
            @PathVariable Integer id,
            @RequestBody AtivoBody body
    ) {
        return catalogos.definirAtivo(tipo, id, body.ativo());
    }

    @DeleteMapping("/clinica/catalogos/{tipo}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable String tipo, @PathVariable Integer id) {
        catalogos.remover(tipo, id);
    }

    public record NovoItem(String nome, Integer especieId, String icone) {
    }

    public record AtivoBody(boolean ativo) {
    }
}
