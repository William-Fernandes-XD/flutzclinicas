package br.com.upvibe.flutz.web;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.clinic.AgendaService;
import br.com.upvibe.flutz.clinic.ClinicPageService;

@RestController
@RequestMapping("/api/public/clinicas")
public class PublicClinicaController {

    private final ClinicPageService pages;
    private final AgendaService agenda;

    public PublicClinicaController(ClinicPageService pages, AgendaService agenda) {
        this.pages = pages;
        this.agenda = agenda;
    }

    @GetMapping("/{slug}")
    public ClinicPageService.PublicaClinica buscar(@PathVariable String slug) {
        return pages.publica(slug);
    }

    @GetMapping("/{slug}/disponibilidade")
    public AgendaService.Disponibilidade disponibilidade(
            @PathVariable String slug,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate
    ) {
        ClinicPageService.PublicaClinica pagina = pages.publica(slug);
        if (pagina.clinica() == null || pagina.clinica().id() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Clínica não encontrada");
        }
        return agenda.disponibilidade(pagina.clinica().id(), de, ate);
    }
}
