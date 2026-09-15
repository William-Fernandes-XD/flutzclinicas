package br.com.upvibe.flutz.bootstrap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import br.com.upvibe.flutz.config.AppProperties;
import br.com.upvibe.flutz.domain.AdministradorSistema;
import br.com.upvibe.flutz.domain.AdministradorSistemaRepository;
import br.com.upvibe.flutz.domain.StatusRepository;

@Component
@Order(2)
public class InitialAdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(InitialAdminBootstrap.class);

    private final AppProperties properties;
    private final AdministradorSistemaRepository administradores;
    private final StatusRepository statuses;
    private final PasswordEncoder passwords;

    public InitialAdminBootstrap(
            AppProperties properties,
            AdministradorSistemaRepository administradores,
            StatusRepository statuses,
            PasswordEncoder passwords
    ) {
        this.properties = properties;
        this.administradores = administradores;
        this.statuses = statuses;
        this.passwords = passwords;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.adminConfigured()) {
            if (properties.production()) {
                throw new IllegalStateException(
                        "INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required in production.");
            }
            log.warn("Initial admin configuration is incomplete.");
            return;
        }

        String email = properties.admin().email().trim();
        if (administradores.findByEmailIgnoreCase(email).isPresent()) {
            log.info("Administrador da plataforma já existe: {}", email);
            return;
        }

        AdministradorSistema admin = new AdministradorSistema();
        admin.setNome(properties.admin().name().trim());
        admin.setEmail(email);
        admin.setSenhaHash(passwords.encode(properties.admin().password()));
        admin.setStatus(statuses.findByDescricaoIgnoreCase("ativo")
                .orElseThrow(() -> new IllegalStateException("Status ativo ausente")));
        administradores.save(admin);
        log.info("Administrador da plataforma criado: {}", email);
    }
}
