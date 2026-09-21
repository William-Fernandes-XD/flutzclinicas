package br.com.upvibe.flutz.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.clinic.ClinicService;
import br.com.upvibe.flutz.security.AuthHolder;

@RestController
@RequestMapping("/api")
public class ClinicController {

    private final ClinicService clinic;

    public ClinicController(ClinicService clinic) {
        this.clinic = clinic;
    }

    @GetMapping("/painel")
    public ClinicService.DashboardResponse painel() {
        AuthHolder.current();
        return clinic.painel();
    }

    @GetMapping("/tutores")
    public List<ClinicService.TutorResponse> tutores() {
        return clinic.tutores();
    }

    @GetMapping("/tutores/busca")
    public ClinicService.TutorPetsResponse buscarTutor(@RequestParam String cpf) {
        return clinic.buscarTutorPorCpf(cpf);
    }

    @PostMapping("/tutores")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicService.TutorResponse criarTutor(@RequestBody ClinicService.NovoTutorRequest request) {
        return clinic.criarTutor(request);
    }

    @GetMapping("/pets")
    public List<ClinicService.PetResponse> pets() {
        return clinic.listarPets();
    }

    @PostMapping("/pets")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicService.PetResponse criarPet(@RequestBody ClinicService.NovoPetRequest request) {
        return clinic.criarPet(request);
    }

    @GetMapping("/servicos")
    public List<ClinicService.ServicoResponse> servicos() {
        return clinic.servicos();
    }

    @PostMapping("/servicos")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicService.ServicoResponse criarServico(@RequestBody ClinicService.NovoServicoRequest request) {
        return clinic.criarServico(request);
    }

    @DeleteMapping("/servicos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerServico(@PathVariable Integer id) {
        clinic.removerServico(id);
    }

    @PostMapping("/servicos/{id}/desativar")
    public ClinicService.ServicoResponse desativarServico(@PathVariable Integer id) {
        return clinic.desativarServico(id);
    }

    @PostMapping("/servicos/{id}/reativar")
    public ClinicService.ServicoResponse reativarServico(@PathVariable Integer id) {
        return clinic.reativarServico(id);
    }

    @GetMapping("/equipe")
    public List<ClinicService.ColaboradorResponse> equipe() {
        return clinic.equipe();
    }

    @PostMapping("/equipe")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicService.ColaboradorResponse criarEquipe(@RequestBody ClinicService.NovoColaboradorRequest request) {
        return clinic.criarColaborador(request);
    }

    @GetMapping("/agendamentos")
    public List<ClinicService.AgendamentoResponse> agenda() {
        return clinic.agenda();
    }

    @PostMapping("/agendamentos")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicService.AgendamentoResponse criarAgenda(@RequestBody ClinicService.NovoAgendamentoRequest request) {
        return clinic.criarAgendamento(request);
    }

    @GetMapping("/atendimentos")
    public List<ClinicService.AtendimentoResponse> atendimentos() {
        return clinic.listarAtendimentos();
    }

    @PostMapping("/atendimentos")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicService.AtendimentoResponse abrirAtendimento(@RequestBody ClinicService.NovoAtendimentoRequest request) {
        return clinic.abrirAtendimento(request);
    }

    @PostMapping("/atendimentos/{id}/concluir")
    public ClinicService.AtendimentoResponse concluirAtendimento(@PathVariable Integer id) {
        return clinic.concluirAtendimento(id);
    }

    @PostMapping("/walk-in")
    @ResponseStatus(HttpStatus.CREATED)
    public ClinicService.WalkInResult registrarWalkIn(@RequestBody ClinicService.WalkInRequest request) {
        return clinic.registrarWalkIn(request);
    }

}
