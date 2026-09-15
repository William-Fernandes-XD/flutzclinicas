package br.com.upvibe.flutz.web;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.auth.AuthService;
import br.com.upvibe.flutz.security.AuthPrincipal;
import br.com.upvibe.flutz.security.SessionCookieService;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/public")
public class CadastroClinicaController {

    private final AuthService auth;
    private final SessionCookieService sessions;

    public CadastroClinicaController(AuthService auth, SessionCookieService sessions) {
        this.auth = auth;
        this.sessions = sessions;
    }

    @PostMapping("/cadastro-clinica")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthController.SessionResponse cadastrar(
            @RequestBody AuthService.CadastroClinicaRequest request,
            HttpServletResponse response
    ) {
        AuthPrincipal principal = auth.cadastrarClinica(request);
        sessions.write(response, principal);
        return AuthController.SessionResponse.from(principal);
    }

    @PostMapping("/cadastro-tutor")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthController.SessionResponse cadastrarTutor(
            @RequestBody AuthService.CadastroTutorRequest request,
            HttpServletResponse response
    ) {
        AuthPrincipal principal = auth.cadastrarTutor(request);
        sessions.write(response, principal);
        return AuthController.SessionResponse.from(principal);
    }
}
