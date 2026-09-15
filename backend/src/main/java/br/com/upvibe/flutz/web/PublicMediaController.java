package br.com.upvibe.flutz.web;

import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.clinic.ClinicMediaService;

@RestController
@RequestMapping("/api/public/arquivos")
public class PublicMediaController {

    private final ClinicMediaService media;

    public PublicMediaController(ClinicMediaService media) {
        this.media = media;
    }

    @GetMapping("/{empresaId}/{nome}")
    public ResponseEntity<Resource> arquivo(@PathVariable Integer empresaId, @PathVariable String nome) {
        ClinicMediaService.RecursoPublico arquivo = media.carregar(empresaId, nome);
        return ResponseEntity.ok()
                .contentType(arquivo.mediaType())
                .cacheControl(CacheControl.noCache())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(arquivo.resource());
    }
}
