package br.com.upvibe.flutz.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import br.com.upvibe.flutz.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Service
public class SessionCookieService {

    public static final String COOKIE_NAME = "flutz_session";

    private final AppProperties properties;

    public SessionCookieService(AppProperties properties) {
        this.properties = properties;
    }

    public void write(HttpServletResponse response, AuthPrincipal principal) {
        long exp = Instant.now().plusMillis(expirationMs()).getEpochSecond();
        String payload = String.join("|",
                principal.tipo().name(),
                String.valueOf(principal.atorId()),
                principal.empresaId() == null ? "" : String.valueOf(principal.empresaId()),
                String.valueOf(exp),
                principal.nome().replace("|", " "),
                principal.identificador().replace("|", " "),
                String.join(",", principal.papeis())
        );
        String token = encode(payload) + "." + sign(payload);
        boolean secure = properties.production();
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, token)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/")
                .maxAge(expirationMs() / 1000)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void clear(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(properties.production())
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public AuthPrincipal read(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (!COOKIE_NAME.equals(cookie.getName()) || cookie.getValue() == null || cookie.getValue().isBlank()) {
                continue;
            }
            return parse(cookie.getValue());
        }
        return null;
    }

    private AuthPrincipal parse(String token) {
        String[] parts = token.split("\\.", 2);
        if (parts.length != 2) {
            return null;
        }
        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            return null;
        }
        if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8), parts[1].getBytes(StandardCharsets.UTF_8))) {
            return null;
        }
        String[] fields = payload.split("\\|", -1);
        if (fields.length < 7) {
            return null;
        }
        long exp = Long.parseLong(fields[3]);
        if (exp < Instant.now().getEpochSecond()) {
            return null;
        }
        Integer empresaId = fields[2].isBlank() ? null : Integer.valueOf(fields[2]);
        List<String> papeis = fields[6].isBlank() ? List.of() : List.of(fields[6].split(","));
        return new AuthPrincipal(
                AtorTipo.valueOf(fields[0]),
                Integer.valueOf(fields[1]),
                empresaId,
                fields[4],
                fields[5],
                papeis
        );
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Não foi possível assinar a sessão", ex);
        }
    }

    private String encode(String payload) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
    }

    private String secret() {
        if (properties.jwtConfigured()) {
            return properties.jwt().secret();
        }
        return "flutz-dev-session-secret-minimo-32-chars";
    }

    private long expirationMs() {
        Long configured = properties.jwt() != null ? properties.jwt().expirationMs() : null;
        return configured == null || configured <= 0 ? 86_400_000L : configured;
    }
}
