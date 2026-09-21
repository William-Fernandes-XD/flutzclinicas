package br.com.upvibe.flutz.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flutz")
public record AppProperties(
        App app,
        Company company,
        Cors cors,
        Jwt jwt,
        Security security,
        Mail mail,
        Admin admin,
        Database database,
        Mercadopago mercadopago
) {

    public record App(String name, String env, String url, String frontendUrl) {
    }

    public record Company(String name, String url) {
    }

    public record Cors(String allowedOrigins) {
    }

    public record Jwt(String secret, Long expirationMs) {
    }

    public record Security(
            Integer passwordResetTokenExpirationMinutes,
            Integer maxLoginAttempts,
            Integer loginLockIncrementSeconds
    ) {
    }

    public record Mail(String from, String fromName) {
    }

    public record Admin(String name, String email, String password) {
    }

    public record Database(String host, String name) {
    }

    public record Mercadopago(
            String publicKey,
            String accessToken,
            String webhookSecret,
            String clientId,
            String clientSecret,
            String redirectUri
    ) {
    }

    public boolean production() {
        String env = app != null ? app.env() : null;
        return env != null
                && ("production".equalsIgnoreCase(env) || "prod".equalsIgnoreCase(env));
    }

    public boolean mailConfigured() {
        return mail != null && hasText(mail.from());
    }

    public boolean jwtConfigured() {
        return jwt != null && hasText(jwt.secret());
    }

    public boolean adminConfigured() {
        return admin != null
                && hasText(admin.name())
                && hasText(admin.email())
                && hasText(admin.password());
    }

    public boolean mercadoPagoConfigured() {
        return mercadopago != null
                && hasText(mercadopago.publicKey())
                && hasText(mercadopago.accessToken());
    }

    /** Credenciais da aplicação OAuth (Connect) para clínicas vincularem a própria conta. */
    public boolean mercadoPagoOAuthConfigured() {
        return mercadopago != null
                && hasText(mercadopago.clientId())
                && hasText(mercadopago.clientSecret())
                && hasText(mercadopago.redirectUri());
    }

    public static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
