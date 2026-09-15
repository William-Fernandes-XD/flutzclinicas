package br.com.upvibe.flutz.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.format.annotation.DateTimeFormat;
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

import br.com.upvibe.flutz.clinic.AgendaService;
import br.com.upvibe.flutz.security.AuthHolder;

@RestController
@RequestMapping("/api")
public class AgendaController {

    private final AgendaService agenda;

    public AgendaController(AgendaService agenda) {
        this.agenda = agenda;
    }

    @GetMapping("/tutor/localizacao")
    public AgendaService.Localizacao localizacaoTutor() {
        AuthHolder.current();
        return agenda.localizacaoTutor();
    }

    @PostMapping("/tutor/localizacao")
    public AgendaService.Localizacao salvarLocalizacao(@RequestBody AgendaService.Localizacao body) {
        return agenda.salvarLocalizacaoTutor(body);
    }

    @GetMapping("/agenda/clinicas")
    public List<AgendaService.ClinicaAgenda> clinicas(
            @RequestParam(required = false) BigDecimal latitude,
            @RequestParam(required = false) BigDecimal longitude
    ) {
        return agenda.clinicas(latitude, longitude);
    }

    @GetMapping("/agenda/disponibilidade")
    public AgendaService.Disponibilidade disponibilidade(
            @RequestParam Integer empresaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate
    ) {
        AuthHolder.current();
        return agenda.disponibilidade(empresaId, de, ate);
    }

    @GetMapping("/agenda/pets")
    public List<AgendaService.PetAgenda> pets(@RequestParam(required = false) Integer empresaId) {
        AuthHolder.current();
        return agenda.petsClinica(empresaId);
    }

    @GetMapping("/agenda/servicos")
    public List<AgendaService.ServicoAgenda> servicos(@RequestParam(required = false) Integer empresaId) {
        AuthHolder.current();
        return agenda.servicosAgenda(empresaId);
    }

    @GetMapping("/agenda/vacinas")
    public List<AgendaService.VacinaOferta> vacinas(@RequestParam(required = false) Integer empresaId) {
        AuthHolder.current();
        return agenda.vacinasAgenda(empresaId);
    }

    @GetMapping("/agenda/solicitacoes")
    public List<AgendaService.Solicitacao> listar(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tipo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate
    ) {
        AuthHolder.current();
        return agenda.listar(status, tipo, de, ate);
    }

    @GetMapping("/agenda/solicitacoes/{id}")
    public AgendaService.Solicitacao detalhe(@PathVariable Integer id) {
        return agenda.detalhe(id);
    }

    @PostMapping("/agenda/solicitacoes")
    @ResponseStatus(HttpStatus.CREATED)
    public AgendaService.Solicitacao criar(@RequestBody AgendaService.NovaSolicitacao body) {
        return agenda.criar(body);
    }

    @PostMapping("/agenda/solicitacoes/{id}/confirmar")
    public AgendaService.Solicitacao confirmar(@PathVariable Integer id, @RequestBody AgendaService.ConfirmarReq body) {
        return agenda.confirmar(id, body);
    }

    @PostMapping("/agenda/solicitacoes/{id}/reatribuir")
    public AgendaService.Solicitacao reatribuir(@PathVariable Integer id, @RequestBody AgendaService.ConfirmarReq body) {
        return agenda.reatribuir(id, body);
    }

    @PostMapping("/agenda/solicitacoes/{id}/recusar")
    public AgendaService.Solicitacao recusar(@PathVariable Integer id, @RequestBody(required = false) AgendaService.MotivoReq body) {
        return agenda.recusar(id, body);
    }

    @PostMapping("/agenda/solicitacoes/{id}/cancelar")
    public AgendaService.Solicitacao cancelar(@PathVariable Integer id, @RequestBody(required = false) AgendaService.MotivoReq body) {
        return agenda.cancelar(id, body);
    }

    @PostMapping("/agenda/solicitacoes/{id}/propor")
    public AgendaService.Solicitacao propor(@PathVariable Integer id, @RequestBody AgendaService.PropostaReq body) {
        return agenda.propor(id, body);
    }

    @PostMapping("/agenda/solicitacoes/{id}/aceitar")
    public AgendaService.Solicitacao aceitar(@PathVariable Integer id) {
        return agenda.aceitarProposta(id);
    }

    @PostMapping("/agenda/solicitacoes/{id}/recusar-proposta")
    public AgendaService.Solicitacao recusarProposta(@PathVariable Integer id, @RequestBody(required = false) AgendaService.MotivoReq body) {
        return agenda.recusarProposta(id, body);
    }

    @PostMapping("/agenda/solicitacoes/{id}/concluir")
    public AgendaService.Solicitacao concluir(@PathVariable Integer id) {
        return agenda.concluir(id);
    }

    @GetMapping("/agenda/vacinas/gestao")
    public List<AgendaService.VacinaOferta> vacinasGestao() {
        return agenda.vacinasGestao();
    }

    @PostMapping("/agenda/vacinas/{id}/preco")
    public AgendaService.VacinaOferta precoVacina(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        Object raw = body == null ? null : body.get("preco");
        BigDecimal preco = raw == null ? null : new BigDecimal(String.valueOf(raw));
        return agenda.salvarPrecoVacina(id, preco);
    }

    @GetMapping("/agenda/expediente")
    public List<AgendaService.Faixa> expediente() {
        return agenda.expediente();
    }

    @PutMapping("/agenda/expediente")
    public List<AgendaService.Faixa> salvarExpediente(@RequestBody List<AgendaService.Faixa> body) {
        return agenda.salvarExpediente(body);
    }

    @GetMapping("/agenda/feriados")
    public List<AgendaService.Feriado> feriados() {
        return agenda.feriados();
    }

    @PostMapping("/agenda/feriados")
    @ResponseStatus(HttpStatus.CREATED)
    public AgendaService.Feriado criarFeriado(@RequestBody AgendaService.Feriado body) {
        return agenda.criarFeriado(body);
    }

    @DeleteMapping("/agenda/feriados/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluirFeriado(@PathVariable Integer id) {
        agenda.excluirFeriado(id);
    }

    @GetMapping("/agenda/bloqueios")
    public List<AgendaService.Bloqueio> bloqueios() {
        return agenda.bloqueios();
    }

    @PostMapping("/agenda/bloqueios")
    @ResponseStatus(HttpStatus.CREATED)
    public AgendaService.Bloqueio criarBloqueio(@RequestBody AgendaService.Bloqueio body) {
        return agenda.criarBloqueio(body);
    }

    @DeleteMapping("/agenda/bloqueios/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluirBloqueio(@PathVariable Integer id) {
        agenda.excluirBloqueio(id);
    }

    @PutMapping("/agenda/notas")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void nota(@RequestBody AgendaService.NotaDia body) {
        agenda.salvarNota(body);
    }

    @GetMapping("/agenda/config")
    public AgendaService.AgendaConfig config() {
        return agenda.config();
    }

    @PutMapping("/agenda/config")
    public AgendaService.AgendaConfig salvarConfig(@RequestBody AgendaService.AgendaConfig body) {
        return agenda.salvarConfig(body);
    }

    @GetMapping("/equipe/{id}/horarios")
    public List<AgendaService.Faixa> horarios(@PathVariable Integer id) {
        return agenda.horariosColaborador(id);
    }

    @PutMapping("/equipe/{id}/horarios")
    public List<AgendaService.Faixa> salvarHorarios(@PathVariable Integer id, @RequestBody List<AgendaService.Faixa> body) {
        return agenda.salvarHorarios(id, body);
    }
}
