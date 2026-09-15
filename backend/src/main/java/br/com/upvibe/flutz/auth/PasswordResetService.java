package br.com.upvibe.flutz.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.config.AppProperties;
import br.com.upvibe.flutz.domain.AdministradorSistema;
import br.com.upvibe.flutz.domain.AdministradorSistemaRepository;
import br.com.upvibe.flutz.domain.Cliente;
import br.com.upvibe.flutz.domain.ClienteRepository;
import br.com.upvibe.flutz.domain.Colaborador;
import br.com.upvibe.flutz.domain.ColaboradorRepository;
import br.com.upvibe.flutz.mail.EmailService;
import br.com.upvibe.flutz.security.AtorTipo;
import jakarta.servlet.http.HttpServletRequest;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final Pattern CPF = Pattern.compile("^\\d{11}$");
    private static final String GENERICA =
            "Se houver uma conta com esses dados, enviamos um código para o e-mail cadastrado.";
    private static final String CODIGO_INVALIDO = "Código inválido ou expirado.";
    private static final int COOLDOWN_SEGUNDOS = 60;

    private final AdministradorSistemaRepository administradores;
    private final ColaboradorRepository colaboradores;
    private final ClienteRepository clientes;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;
    private final AppProperties properties;
    private final EmailService email;

    public PasswordResetService(
            AdministradorSistemaRepository administradores,
            ColaboradorRepository colaboradores,
            ClienteRepository clientes,
            PasswordEncoder passwords,
            JdbcTemplate jdbc,
            AppProperties properties,
            EmailService email
    ) {
        this.administradores = administradores;
        this.colaboradores = colaboradores;
        this.clientes = clientes;
        this.passwords = passwords;
        this.jdbc = jdbc;
        this.properties = properties;
        this.email = email;
    }

    public String solicitar(String identificador, HttpServletRequest request) {
        String raw = identificador == null ? "" : identificador.trim();
        if (raw.isBlank()) {
            return GENERICA;
        }
        String chave = "recuperar|" + raw.toLowerCase(Locale.ROOT) + "|" + ip(request);
        if (bloqueado(chave)) {
            return GENERICA;
        }

        Actor actor = findActor(raw);
        if (actor != null && AppProperties.hasText(actor.email())) {
            String codigo = String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
            Instant expira = Instant.now().plusSeconds(expirationMinutes() * 60L);
            jdbc.update(
                    """
                    UPDATE flutz.recuperacao_senha
                    SET utilizado_em = CURRENT_TIMESTAMP
                    WHERE ator_tipo = ? AND ator_id = ? AND utilizado_em IS NULL
                    """,
                    actor.tipo().name(),
                    actor.id()
            );
            jdbc.update(
                    """
                    INSERT INTO flutz.recuperacao_senha
                        (ator_tipo, ator_id, token_hash, data_expiracao, data_criacao)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    actor.tipo().name(),
                    actor.id(),
                    sha256(codigo),
                    java.sql.Timestamp.from(expira)
            );
            try {
                email.send(actor.email(), "Código para redefinir sua senha — Flutz", corpo(actor.nome(), codigo));
            } catch (Exception ex) {
                log.warn("Password reset e-mail was not sent for actor {} {}", actor.tipo(), actor.id(), ex);
            }
        }

        marcarCooldown(chave);
        return GENERICA;
    }

    @Transactional
    public void redefinir(String identificador, String codigo, String novaSenha) {
        if (novaSenha == null || novaSenha.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha precisa ter pelo menos 8 caracteres");
        }
        String digits = codigo == null ? "" : codigo.replaceAll("\\D", "");
        if (digits.length() != 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, CODIGO_INVALIDO);
        }
        Actor actor = findActor(identificador == null ? "" : identificador.trim());
        if (actor == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, CODIGO_INVALIDO);
        }
        String hash = sha256(digits);
        Integer id = jdbc.query(
                """
                SELECT recuperacao_senha_id
                FROM flutz.recuperacao_senha
                WHERE ator_tipo = ? AND ator_id = ? AND token_hash = ?
                  AND utilizado_em IS NULL AND data_expiracao > CURRENT_TIMESTAMP
                ORDER BY data_criacao DESC
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getInt(1) : null,
                actor.tipo().name(),
                actor.id(),
                hash
        );
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, CODIGO_INVALIDO);
        }
        String senhaHash = passwords.encode(novaSenha);
        switch (actor.tipo()) {
            case ADMINISTRADOR_SISTEMA -> administradores.findById(actor.id()).ifPresent(admin -> {
                admin.setSenhaHash(senhaHash);
                administradores.save(admin);
            });
            case COLABORADOR -> colaboradores.findById(actor.id()).ifPresent(colaborador -> {
                colaborador.setSenhaHash(senhaHash);
                colaboradores.save(colaborador);
            });
            case CLIENTE -> clientes.findById(actor.id()).ifPresent(cliente -> {
                cliente.setSenhaHash(senhaHash);
                clientes.save(cliente);
            });
        }
        jdbc.update(
                "UPDATE flutz.recuperacao_senha SET utilizado_em = CURRENT_TIMESTAMP WHERE recuperacao_senha_id = ?",
                id
        );
        jdbc.update(
                """
                UPDATE flutz.recuperacao_senha
                SET utilizado_em = CURRENT_TIMESTAMP
                WHERE ator_tipo = ? AND ator_id = ? AND utilizado_em IS NULL
                """,
                actor.tipo().name(),
                actor.id()
        );
    }

    private Actor findActor(String raw) {
        String digits = raw.replaceAll("\\D", "");
        if (CPF.matcher(digits).matches()) {
            return clientes.findByCpf(digits)
                    .filter(Cliente::ativo)
                    .map(cliente -> new Actor(AtorTipo.CLIENTE, cliente.getId(), cliente.getEmail(), cliente.getNomeCliente()))
                    .orElse(null);
        }
        return administradores.findByEmailIgnoreCase(raw)
                .filter(AdministradorSistema::ativo)
                .map(admin -> new Actor(AtorTipo.ADMINISTRADOR_SISTEMA, admin.getId(), admin.getEmail(), admin.getNome()))
                .or(() -> colaboradores.findByEmailIgnoreCase(raw)
                        .filter(Colaborador::ativo)
                        .map(colaborador -> new Actor(
                                AtorTipo.COLABORADOR,
                                colaborador.getId(),
                                colaborador.getEmail(),
                                colaborador.getNomeColaborador()
                        )))
                .or(() -> clientes.findByEmailIgnoreCase(raw).stream()
                        .filter(Cliente::ativo)
                        .findFirst()
                        .map(cliente -> new Actor(AtorTipo.CLIENTE, cliente.getId(), cliente.getEmail(), cliente.getNomeCliente())))
                .orElse(null);
    }

    private int expirationMinutes() {
        Integer minutes = properties.security() == null
                ? null
                : properties.security().passwordResetTokenExpirationMinutes();
        return minutes == null || minutes <= 0 ? 30 : minutes;
    }

    private boolean bloqueado(String chave) {
        Instant now = Instant.now();
        List<Instant> bloqueios = jdbc.query(
                "SELECT bloqueado_ate FROM flutz.tentativa_login WHERE chave = ?",
                (rs, rowNum) -> rs.getTimestamp("bloqueado_ate") == null
                        ? null
                        : rs.getTimestamp("bloqueado_ate").toInstant(),
                chave
        );
        return bloqueios.stream().anyMatch(ate -> ate != null && ate.isAfter(now));
    }

    private void marcarCooldown(String chave) {
        jdbc.update(
                """
                INSERT INTO flutz.tentativa_login (chave, falhas, bloqueado_ate, ultima_falha)
                VALUES (?, 1, CURRENT_TIMESTAMP + make_interval(secs => ?), CURRENT_TIMESTAMP)
                ON CONFLICT (chave) DO UPDATE
                SET falhas = flutz.tentativa_login.falhas + 1,
                    bloqueado_ate = CURRENT_TIMESTAMP + make_interval(secs => ?),
                    ultima_falha = CURRENT_TIMESTAMP
                """,
                chave,
                COOLDOWN_SEGUNDOS,
                COOLDOWN_SEGUNDOS
        );
    }

    private String corpo(String nome, String codigo) {
        String saudacao = AppProperties.hasText(nome) ? "Olá, " + nome.trim() + "." : "Olá.";
        return saudacao
                + "\n\nRecebemos um pedido para redefinir a senha da sua conta no Flutz."
                + "\n\nSeu código é: "
                + codigo
                + "\n\nEle vale por "
                + expirationMinutes()
                + " minutos e só pode ser usado uma vez."
                + "\nSe você não pediu isso, ignore este e-mail."
                + "\n\nFlutz";
    }

    private static String ip(HttpServletRequest request) {
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private record Actor(AtorTipo tipo, Integer id, String email, String nome) {
    }
}
