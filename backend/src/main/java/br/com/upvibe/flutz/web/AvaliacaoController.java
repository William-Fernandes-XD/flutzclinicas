package br.com.upvibe.flutz.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.clinic.AvaliacaoService;
import br.com.upvibe.flutz.security.AuthHolder;

@RestController
@RequestMapping("/api")
public class AvaliacaoController {

    private final AvaliacaoService avaliacoes;

    public AvaliacaoController(AvaliacaoService avaliacoes) {
        this.avaliacoes = avaliacoes;
    }

    @GetMapping("/clinicas/{empresaId}/avaliacoes")
    public List<AvaliacaoService.AvaliacaoPublica> porClinica(@PathVariable Integer empresaId) {
        AuthHolder.current();
        return avaliacoes.listarPorEmpresa(empresaId);
    }

    @GetMapping("/tutor/avaliacoes/pendentes")
    public List<AvaliacaoService.Pendente> pendentes() {
        return avaliacoes.pendentesTutor();
    }

    @PostMapping("/tutor/avaliacoes")
    @ResponseStatus(HttpStatus.CREATED)
    public AvaliacaoService.AvaliacaoPublica criar(@RequestBody AvaliacaoService.NovaAvaliacao body) {
        return avaliacoes.criar(body);
    }
}
