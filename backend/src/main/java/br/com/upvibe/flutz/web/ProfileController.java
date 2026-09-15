package br.com.upvibe.flutz.web;

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
import br.com.upvibe.flutz.clinic.ProfileService;

@RestController
@RequestMapping("/api/perfil")
public class ProfileController {

    private final ProfileService profiles;

    public ProfileController(ProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping
    public ProfileService.Perfil atual() {
        return profiles.atual();
    }

    @PutMapping
    public ProfileService.Perfil salvar(@RequestBody ProfileService.Atualizacao body) {
        return profiles.salvar(body);
    }

    @PutMapping("/pets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void pet(@PathVariable Integer id, @RequestBody ProfileService.PetAtualizacao body) {
        profiles.salvarPet(id, body);
    }

    @PostMapping(value = "/foto", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ClinicMediaService.ArquivoSalvo foto(
            @RequestParam String alvo,
            @RequestParam(required = false) Integer petId,
            @RequestParam(required = false) Integer colaboradorId,
            @RequestParam(required = false) Integer clienteId,
            @RequestParam MultipartFile arquivo
    ) {
        return profiles.foto(alvo, petId, colaboradorId, clienteId, arquivo);
    }
}
