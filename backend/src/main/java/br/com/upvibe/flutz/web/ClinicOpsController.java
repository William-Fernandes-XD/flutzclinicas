package br.com.upvibe.flutz.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import br.com.upvibe.flutz.clinic.ClinicMediaService;
import br.com.upvibe.flutz.clinic.ClinicOpsService;
import br.com.upvibe.flutz.clinic.ClinicPageService;
import br.com.upvibe.flutz.security.AuthPrincipal;
import br.com.upvibe.flutz.security.SessionCookieService;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api")
public class ClinicOpsController {

    private final ClinicOpsService ops;
    private final ClinicPageService pages;
    private final SessionCookieService sessions;

    public ClinicOpsController(ClinicOpsService ops, ClinicPageService pages, SessionCookieService sessions) {
        this.ops = ops;
        this.pages = pages;
        this.sessions = sessions;
    }

    @PostMapping("/auth/contexto")
    public AuthController.SessionResponse contexto(@RequestBody ContextoRequest request, HttpServletResponse response) {
        AuthPrincipal principal = ops.aplicarContexto(request.empresaId());
        sessions.write(response, principal);
        return AuthController.SessionResponse.from(principal);
    }

    @GetMapping("/contexto/clinica")
    public ClinicOpsService.ClinicaContexto clinicaAtual() {
        return ops.contextoAtual();
    }

    @GetMapping("/tutor/clinicas")
    public List<ClinicOpsService.ClinicaTutor> clinicasTutor() {
        return ops.clinicasTutor();
    }

    @GetMapping("/indicadores/clinica")
    public ClinicOpsService.IndicadoresClinica indicadores() {
        return ops.indicadores();
    }

    @GetMapping("/consulta/pets")
    public List<ClinicOpsService.ConsultaPet> consultarPets(
            @RequestParam(required = false) String nome,
            @RequestParam(required = false) String cpf
    ) {
        return ops.consultarPets(nome, cpf);
    }

    @GetMapping("/pets/{id}")
    public ClinicOpsService.PetDetalhe pet(@PathVariable Integer id) {
        return ops.pet(id);
    }

    @GetMapping("/vacinacoes")
    public List<ClinicOpsService.VacinaLinha> vacinacoes() {
        return ops.vacinacoesClinica();
    }

    @GetMapping("/tutor/vacinacoes")
    public List<ClinicOpsService.VacinaLinha> vacinacoesTutor() {
        return ops.vacinacoesTutor();
    }

    @PostMapping("/vacinacoes")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicOpsService.VacinaLinha registrarVacina(@RequestBody ClinicOpsService.NovaVacina request) {
        return ops.registrarVacina(request);
    }

    @GetMapping("/especialidades")
    public List<ClinicOpsService.Item> especialidades() {
        return ops.especialidades();
    }

    @PostMapping("/especialidades")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicOpsService.Item especialidade(@RequestBody IdRequest request) {
        return ops.oferecerEspecialidade(request.id());
    }

    @GetMapping("/pagina")
    public ClinicPageService.Editor pagina() {
        return pages.carregar();
    }

    @PutMapping("/pagina/layout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void layout(@RequestBody List<ClinicPageService.Secao> secoes) {
        pages.salvarLayout(secoes);
    }

    @PutMapping("/pagina/secoes")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void secao(@RequestBody ClinicPageService.Secao secao) {
        pages.salvarLayout(List.of(secao));
    }

    @PutMapping("/pagina/hero")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void hero(@RequestBody ClinicPageService.HeroReq hero) {
        pages.salvarHero(hero);
    }

    @PutMapping("/clinica/endereco")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void endereco(@RequestBody ClinicPageService.Endereco endereco) {
        pages.salvarEndereco(endereco);
    }

    @PutMapping("/clinica/contato")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void contato(@RequestBody ClinicPageService.ContatoReq contato) {
        pages.salvarContato(contato);
    }

    @PutMapping("/pagina/visibilidade")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void visibilidade(@RequestBody ClinicPageService.Visibilidade body) {
        pages.salvarVisibilidade(body);
    }

    @PostMapping("/pagina/doacoes")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicPageService.Item doacao(@RequestBody ClinicPageService.NovaDoacao body) {
        return pages.criarDoacao(body);
    }

    @PutMapping("/clinica/identidade")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void identidade(@RequestBody ClinicOpsService.Identidade identidade) {
        ops.salvarIdentidade(identidade);
    }

    @PostMapping(value = "/arquivos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ClinicMediaService.ArquivoSalvo arquivo(
            @RequestParam String destino,
            @RequestParam MultipartFile arquivo
    ) {
        return ops.salvarArquivo(destino, arquivo);
    }

    @GetMapping("/avaliacoes")
    public List<ClinicOpsService.Avaliacao> avaliacoes() {
        return ops.avaliacoes();
    }

    @GetMapping("/chats")
    public List<ClinicOpsService.ChatResumo> chats() {
        return ops.chats();
    }

    @GetMapping("/tutor/chats")
    public List<ClinicOpsService.TutorConversa> chatsTutor() {
        return ops.conversasTutor();
    }

    @PostMapping("/tutor/chats")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicOpsService.TutorConversa abrirChatTutor(@RequestBody ClinicOpsService.AbrirConversaTutor request) {
        return ops.abrirConversaTutor(request == null ? null : request.empresaId());
    }

    @GetMapping("/chats/{id}")
    public ClinicOpsService.ChatDetalhe chat(@PathVariable Integer id) {
        return ops.chat(id);
    }

    @PostMapping("/chats")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicOpsService.ChatResumo abrir(@RequestBody ClinicOpsService.NovoChat request) {
        return ops.abrirChat(request);
    }

    @PostMapping("/chats/{id}/mensagens")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicOpsService.Mensagem mensagem(@PathVariable Integer id, @RequestBody TextoRequest request) {
        return ops.enviarMensagem(id, request.texto());
    }

    @PostMapping("/chats/{id}/encerrar")
    public void encerrar(@PathVariable Integer id, @RequestBody(required = false) TextoRequest request) {
        ops.encerrarChat(id, request == null ? null : request.texto());
    }

    public record ContextoRequest(Integer empresaId) {
    }

    public record IdRequest(Integer id) {
    }

    public record TextoRequest(String texto) {
    }
}
