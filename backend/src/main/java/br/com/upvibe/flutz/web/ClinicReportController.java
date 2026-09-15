package br.com.upvibe.flutz.web;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.clinic.ClinicReportService;
import br.com.upvibe.flutz.security.AuthHolder;

@RestController
@RequestMapping("/api/clinica/relatorios")
public class ClinicReportController {

    private final ClinicReportService reports;

    public ClinicReportController(ClinicReportService reports) {
        this.reports = reports;
    }

    @GetMapping("/visao-geral")
    public ClinicReportService.VisaoGeral visaoGeral(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(required = false) Integer profissionalId,
            @RequestParam(required = false) Integer servicoId,
            @RequestParam(required = false) String status
    ) {
        AuthHolder.current();
        return reports.visaoGeral(de, ate, profissionalId, servicoId, status);
    }
}
