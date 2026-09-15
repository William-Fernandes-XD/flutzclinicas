package br.com.upvibe.flutz.lgpd;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LgpdController {

    private final LgpdService lgpd;

    public LgpdController(LgpdService lgpd) {
        this.lgpd = lgpd;
    }

    @GetMapping("/api/lgpd/solicitacoes")
    public List<LgpdService.SolicitacaoLgpd> minhasSolicitacoes() {
        return lgpd.listarMinhas();
    }

    @PostMapping("/api/lgpd/solicitacoes")
    @ResponseStatus(HttpStatus.CREATED)
    public LgpdService.ResultadoSolicitacao criar(@RequestBody LgpdService.NovaSolicitacao body) {
        return lgpd.criar(body);
    }

    @GetMapping("/api/lgpd/exportacao")
    public LgpdService.PacotePortabilidade exportacao() {
        return lgpd.exportacao();
    }

    @GetMapping("/api/lgpd/acesso")
    public LgpdService.PacotePortabilidade acesso() {
        return lgpd.acesso();
    }

    @GetMapping("/api/admin/lgpd/solicitacoes")
    public List<LgpdService.SolicitacaoLgpd> solicitacoesAdmin() {
        return lgpd.listarAdmin();
    }

    @PostMapping("/api/admin/lgpd/solicitacoes/{id}/status")
    public LgpdService.SolicitacaoLgpd atualizarStatus(
            @PathVariable Integer id,
            @RequestBody LgpdService.AtualizacaoStatus body
    ) {
        return lgpd.atualizarStatus(id, body);
    }

    @PostMapping("/api/admin/lgpd/solicitacoes/{id}/anonimizar")
    public LgpdService.SolicitacaoLgpd anonimizar(@PathVariable Integer id) {
        return lgpd.anonimizar(id);
    }
}
