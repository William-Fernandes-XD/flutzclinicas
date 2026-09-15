package br.com.upvibe.flutz.config;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class StartupConfigValidator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StartupConfigValidator.class);

    private final AppProperties properties;
    private final Environment environment;

    public StartupConfigValidator(AppProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<String> missingRequired = new ArrayList<>();

        if (!AppProperties.hasText(resolvedDatabaseHost())) {
            missingRequired.add("DATABASE_HOST");
        }
        if (!AppProperties.hasText(resolvedDatabaseName())) {
            missingRequired.add("DATABASE_NAME");
        }

        if (!missingRequired.isEmpty()) {
            throw new IllegalStateException(
                    "Required configuration is missing: " + String.join(", ", missingRequired));
        }

        if (properties.production()) {
            validateProduction();
            return;
        }

        warnIfMissing("MAIL_HOST / MAIL_FROM", mailReady(),
                "Mail is not configured. Email sending stays disabled in this environment.");
        warnIfMissing("JWT_SECRET", properties.jwtConfigured(),
                "JWT_SECRET is not set. Token-based login will be added in a later phase.");
        warnIfMissing("INITIAL_ADMIN_*", properties.adminConfigured(),
                "Initial admin credentials are not set. Phase 3 will persist administrador_sistema.");
    }

    private void validateProduction() {
        List<String> missing = new ArrayList<>();

        if (!AppProperties.hasText(environment.getProperty("DATABASE_USERNAME"))) {
            missing.add("DATABASE_USERNAME");
        }
        if (!AppProperties.hasText(environment.getProperty("DATABASE_PASSWORD"))) {
            missing.add("DATABASE_PASSWORD");
        }
        if (!AppProperties.hasText(environment.getProperty("MAIL_HOST"))) {
            missing.add("MAIL_HOST");
        }
        if (!properties.mailConfigured()) {
            missing.add("MAIL_FROM");
        }
        if (!properties.jwtConfigured()) {
            missing.add("JWT_SECRET");
        } else if (properties.jwt().secret().length() < 32) {
            missing.add("JWT_SECRET (minimum 32 characters)");
        }
        if (properties.cors() == null || !AppProperties.hasText(properties.cors().allowedOrigins())) {
            missing.add("CORS_ALLOWED_ORIGINS");
        }
        if (properties.admin() == null || !AppProperties.hasText(properties.admin().name())) {
            missing.add("INITIAL_ADMIN_NAME");
        }
        if (properties.admin() == null || !AppProperties.hasText(properties.admin().email())) {
            missing.add("INITIAL_ADMIN_EMAIL");
        }
        if (properties.admin() == null || !AppProperties.hasText(properties.admin().password())) {
            missing.add("INITIAL_ADMIN_PASSWORD");
        }

        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "APP_ENV=production requires: " + String.join(", ", missing));
        }
    }

    private boolean mailReady() {
        return AppProperties.hasText(environment.getProperty("MAIL_HOST")) && properties.mailConfigured();
    }

    private void warnIfMissing(String name, boolean present, String message) {
        if (!present) {
            log.warn("Missing {} in development. {}", name, message);
        }
    }

    private String resolvedDatabaseHost() {
        if (properties.database() != null && AppProperties.hasText(properties.database().host())) {
            return properties.database().host();
        }
        return environment.getProperty("DATABASE_HOST");
    }

    private String resolvedDatabaseName() {
        if (properties.database() != null && AppProperties.hasText(properties.database().name())) {
            return properties.database().name();
        }
        return environment.getProperty("DATABASE_NAME");
    }
}
