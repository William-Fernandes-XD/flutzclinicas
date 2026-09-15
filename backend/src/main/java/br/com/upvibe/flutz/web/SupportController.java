package br.com.upvibe.flutz.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.support.SupportService;

@RestController
public class SupportController {

    private final SupportService support;

    public SupportController(SupportService support) {
        this.support = support;
    }

    @PostMapping("/api/suporte")
    @ResponseStatus(HttpStatus.CREATED)
    public SupportService.TicketMeu abrir(@RequestBody SupportService.NovoTicket body) {
        return support.abrir(body);
    }

    @GetMapping("/api/suporte")
    public List<SupportService.TicketMeu> meus() {
        return support.listarMeus();
    }

    @PutMapping("/api/suporte/{id}")
    public SupportService.TicketMeu editar(
            @PathVariable Integer id,
            @RequestBody SupportService.NovoTicket body
    ) {
        return support.editar(id, body);
    }

    @DeleteMapping("/api/suporte/{id}")
    public SupportService.TicketMeu excluir(@PathVariable Integer id) {
        return support.excluir(id);
    }

    @GetMapping("/api/admin/tickets")
    public List<SupportService.TicketAdmin> tickets() {
        return support.listar();
    }

    @PostMapping("/api/admin/tickets/{id}/status")
    public SupportService.TicketAdmin atualizarStatus(
            @PathVariable Integer id,
            @RequestBody SupportService.StatusTicket body
    ) {
        return support.atualizarStatus(id, body.status());
    }

    @PostMapping("/api/admin/tickets/{id}/resposta")
    public SupportService.TicketAdmin responder(
            @PathVariable Integer id,
            @RequestBody SupportService.RespostaTicket body
    ) {
        return support.responder(id, body.resposta(), body.status());
    }
}
