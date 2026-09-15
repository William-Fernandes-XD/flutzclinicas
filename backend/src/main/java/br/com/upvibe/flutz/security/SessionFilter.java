package br.com.upvibe.flutz.security;

import java.io.IOException;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import br.com.upvibe.flutz.billing.AssinaturaAccessService;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class SessionFilter extends OncePerRequestFilter {

    private final SessionCookieService sessions;
    private final AssinaturaAccessService assinaturaAccess;

    public SessionFilter(SessionCookieService sessions, AssinaturaAccessService assinaturaAccess) {
        this.sessions = sessions;
        this.assinaturaAccess = assinaturaAccess;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            AuthPrincipal auth = sessions.read(request);
            AuthHolder.set(auth);
            if (deveBloquear(request, auth)) {
                response.sendError(HttpServletResponse.SC_PAYMENT_REQUIRED, "Mensalidade em atraso. Regularize a assinatura para continuar.");
                return;
            }
            filterChain.doFilter(request, response);
        } finally {
            AuthHolder.clear();
        }
    }

    private boolean deveBloquear(HttpServletRequest request, AuthPrincipal auth) {
        if (auth == null || !auth.colaborador() || auth.empresaId() == null || !metodoMutante(request.getMethod())) {
            return false;
        }
        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || permitido(path)) {
            return false;
        }
        return !assinaturaAccess.clinicaPodeOperar(auth.empresaId());
    }

    private static boolean metodoMutante(String method) {
        return "POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method) || "DELETE".equals(method);
    }

    private static boolean permitido(String path) {
        return path.startsWith("/api/assinatura/")
                || path.startsWith("/api/suporte")
                || path.startsWith("/api/lgpd")
                || path.startsWith("/api/perfil")
                || path.startsWith("/api/auth/")
                || path.startsWith("/api/notificacoes");
    }
}
