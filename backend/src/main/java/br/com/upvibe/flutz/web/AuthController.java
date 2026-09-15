package br.com.upvibe.flutz.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.auth.AuthService;
import br.com.upvibe.flutz.auth.PasswordResetService;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;
import br.com.upvibe.flutz.security.SessionCookieService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotBlank;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final PasswordResetService passwordReset;
    private final SessionCookieService sessions;

    public AuthController(AuthService auth, PasswordResetService passwordReset, SessionCookieService sessions) {
        this.auth = auth;
        this.passwordReset = passwordReset;
        this.sessions = sessions;
    }

    @PostMapping("/login")
    public SessionResponse login(@RequestBody LoginRequest request, HttpServletRequest http, HttpServletResponse response) {
        try {
            AuthPrincipal principal = auth.login(request.identificador(), request.senha(), http);
            sessions.write(response, principal);
            return SessionResponse.from(principal);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Não foi possível entrar. Verifique os dados.");
        }
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletResponse response) {
        sessions.clear(response);
    }

    @PostMapping("/recuperar")
    public RecuperarResponse recuperar(@RequestBody RecuperarRequest request, HttpServletRequest http) {
        return new RecuperarResponse(passwordReset.solicitar(request.identificador(), http));
    }

    @PostMapping("/redefinir")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void redefinir(@RequestBody RedefinirRequest request) {
        passwordReset.redefinir(request.identificador(), request.codigo(), request.novaSenha());
    }

    @GetMapping("/me")
    public SessionResponse me() {
        AuthPrincipal principal = AuthHolder.optional();
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sessão ausente");
        }
        return SessionResponse.from(principal);
    }

    public record LoginRequest(@NotBlank String identificador, @NotBlank String senha) {
    }

    public record RecuperarRequest(@NotBlank String identificador) {
    }

    public record RedefinirRequest(
            @NotBlank String identificador,
            @NotBlank String codigo,
            @NotBlank String novaSenha
    ) {
    }

    public record RecuperarResponse(String message) {
    }

    public record SessionResponse(
            String tipo,
            Integer atorId,
            Integer empresaId,
            String nome,
            String identificador,
            List<String> papeis
    ) {
        public static SessionResponse from(AuthPrincipal principal) {
            return new SessionResponse(
                    principal.tipo().name(),
                    principal.atorId(),
                    principal.empresaId(),
                    principal.nome(),
                    principal.identificador(),
                    principal.papeis()
            );
        }
    }
}
