package br.com.upvibe.flutz.security;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class AuthHolder {

    private static final ThreadLocal<AuthPrincipal> CURRENT = new ThreadLocal<>();

    private AuthHolder() {
    }

    public static void set(AuthPrincipal principal) {
        CURRENT.set(principal);
    }

    public static void clear() {
        CURRENT.remove();
    }

    public static AuthPrincipal current() {
        AuthPrincipal principal = CURRENT.get();
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sessão ausente");
        }
        return principal;
    }

    public static AuthPrincipal optional() {
        return CURRENT.get();
    }
}
