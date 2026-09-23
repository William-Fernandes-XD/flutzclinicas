package br.com.upvibe.flutz.billing;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import br.com.upvibe.flutz.clinic.ClinicService;
import br.com.upvibe.flutz.config.AppProperties;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class MercadoPagoOAuthService {

    private static final Logger log = LoggerFactory.getLogger(MercadoPagoOAuthService.class);
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration STATE_TTL = Duration.ofMinutes(15);
    private static final Duration REFRESH_SKEW = Duration.ofMinutes(5);
    private static final String AUTH_URL = "https://auth.mercadopago.com/authorization";
    private static final String TOKEN_URL = "https://api.mercadopago.com/oauth/token";

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;
    private final AppProperties properties;
    private final ObjectMapper json;

    public MercadoPagoOAuthService(
            JdbcTemplate jdbc,
            ClinicService clinic,
            AppProperties properties,
            ObjectMapper json
    ) {
        this.jdbc = jdbc;
        this.clinic = clinic;
        this.properties = properties;
        this.json = json;
    }

    public ConnectStart iniciarConexao() {
        exigirAdminClinica();
        exigirOAuthConfigurado();
        Integer empresaId = clinic.empresaAtual().getId();
        AuthPrincipal auth = AuthHolder.current();
        String state = novoState();
        String codeVerifier = novoCodeVerifier();
        String codeChallenge = codeChallengeS256(codeVerifier);
        Instant expires = Instant.now().plus(STATE_TTL);
        jdbc.update(
                """
                INSERT INTO flutz.mercadopago_oauth_state
                  (state_token, empresa_id, ator_id, expires_at, code_verifier)
                VALUES (?, ?, ?, ?, ?)
                """,
                state,
                empresaId,
                auth.atorId(),
                Timestamp.from(expires),
                codeVerifier
        );
        String redirectUri = redirectUriConfigurado();
        // Montagem manual evita double-encode do redirect_uri (MP exige match exato).
        String url = AUTH_URL
                + "?client_id=" + urlEncode(properties.mercadopago().clientId().trim())
                + "&response_type=code"
                + "&platform_id=mp"
                + "&state=" + urlEncode(state)
                + "&redirect_uri=" + urlEncode(redirectUri)
                + "&code_challenge=" + urlEncode(codeChallenge)
                + "&code_challenge_method=S256";
        log.info("OAuth MP iniciar empresa={} redirectUri={}", empresaId, redirectUri);
        return new ConnectStart(url, expires.toString(), redirectUri);
    }

    public String redirectUriConfigurado() {
        if (properties.mercadoPagoOAuthConfigured()) {
            return properties.mercadopago().redirectUri().trim();
        }
        String appUrl = properties.app() != null && AppProperties.hasText(properties.app().url())
                ? properties.app().url().trim().replaceAll("/+$", "")
                : "http://localhost:8081";
        return appUrl + "/api/public/mercadopago/oauth/callback";
    }

    @Transactional
    public CallbackResult processarCallback(String code, String state, String error, String errorDescription) {
        String frontend = properties.app() == null || !AppProperties.hasText(properties.app().frontendUrl())
                ? "http://localhost:5173"
                : properties.app().frontendUrl().trim();
        String base = frontend.replaceAll("/+$", "") + "/app/financeiro";
        log.info(
                "OAuth MP callback redirectUri={} code={} state={} error={}",
                redirectUriConfigurado(),
                AppProperties.hasText(code),
                AppProperties.hasText(state) ? state.trim().substring(0, Math.min(8, state.trim().length())) + "…" : false,
                error
        );

        if (AppProperties.hasText(error)) {
            log.info("OAuth MP cancelado/erro: {} — {}", error, errorDescription);
            String msg = "access_denied".equalsIgnoreCase(error)
                    ? "A autorização foi cancelada."
                    : "Não foi possível conectar sua conta Mercado Pago. Tente novamente.";
            return CallbackResult.redirect(base + "?mp=erro&motivo=" + urlEncode(msg));
        }
        if (!AppProperties.hasText(code) || !AppProperties.hasText(state)) {
            return CallbackResult.redirect(base + "?mp=erro&motivo=" + urlEncode("Não foi possível conectar sua conta Mercado Pago. Tente novamente."));
        }

        StateRow stateRow = consumirState(state.trim());
        if (stateRow == null) {
            return CallbackResult.redirect(base + "?mp=erro&motivo=" + urlEncode("A autorização expirou ou é inválida. Inicie a conexão novamente."));
        }

        try {
            exigirOAuthConfigurado();
            TokenResponse tokens = trocarCodigo(code.trim(), stateRow.codeVerifier());
            persistirConexao(stateRow.empresaId(), tokens);
            return CallbackResult.redirect(base + "?mp=conectado");
        } catch (ResponseStatusException ex) {
            log.warn("Falha no callback OAuth MP empresa={}: {}", stateRow.empresaId(), ex.getReason());
            String msg = ex.getReason() == null
                    ? "Não foi possível conectar sua conta Mercado Pago. Tente novamente."
                    : ex.getReason();
            return CallbackResult.redirect(base + "?mp=erro&motivo=" + urlEncode(msg));
        } catch (Exception ex) {
            log.error("Erro inesperado no callback OAuth MP: {}", ex.getMessage());
            return CallbackResult.redirect(base + "?mp=erro&motivo=" + urlEncode("Não foi possível conectar sua conta Mercado Pago. Tente novamente."));
        }
    }

    /**
     * Obtém access token válido da clínica (renova se necessário).
     * Mantém fallback para contas manuais legadas.
     */
    @Transactional
    public ClinicPaymentAccountService.ContaCredenciais exigirCredenciaisValidas(Integer empresaId) {
        if (empresaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Empresa inválida");
        }
        ContaRow conta = carregarConta(empresaId);
        if (conta == null || !"CONECTADA".equalsIgnoreCase(conta.status())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Esta clínica ainda não possui uma conta Mercado Pago conectada."
            );
        }
        if (!AppProperties.hasText(conta.accessToken())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Esta clínica ainda não possui uma conta Mercado Pago conectada."
            );
        }
        if ("oauth".equalsIgnoreCase(conta.authMode()) && precisaRenovar(conta)) {
            if (!AppProperties.hasText(conta.refreshToken())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "A conexão com o Mercado Pago expirou. Conecte sua conta novamente."
                );
            }
            try {
                TokenResponse renovado = renovarToken(conta.refreshToken());
                atualizarTokens(conta.id(), renovado);
                return new ClinicPaymentAccountService.ContaCredenciais(
                        conta.id(),
                        AppProperties.hasText(renovado.publicKey()) ? renovado.publicKey() : conta.publicKey(),
                        renovado.accessToken()
                );
            } catch (ResponseStatusException ex) {
                marcarExpirada(conta.id());
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "A conexão com o Mercado Pago expirou. Conecte sua conta novamente."
                );
            }
        }
        if (!AppProperties.hasText(conta.publicKey())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Conta Mercado Pago incompleta. Conecte novamente em Financeiro."
            );
        }
        return new ClinicPaymentAccountService.ContaCredenciais(conta.id(), conta.publicKey(), conta.accessToken());
    }

    public boolean oauthDisponivel() {
        return properties.mercadoPagoOAuthConfigured();
    }

    private StateRow consumirState(String state) {
        StateRow row = jdbc.query(
                """
                SELECT oauth_state_id, empresa_id, ator_id, expires_at, used_at, code_verifier
                FROM flutz.mercadopago_oauth_state
                WHERE state_token = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    Timestamp used = rs.getTimestamp("used_at");
                    Timestamp exp = rs.getTimestamp("expires_at");
                    return new StateRow(
                            rs.getInt("oauth_state_id"),
                            rs.getInt("empresa_id"),
                            rs.getInt("ator_id"),
                            exp == null ? null : exp.toInstant(),
                            used == null ? null : used.toInstant(),
                            rs.getString("code_verifier")
                    );
                },
                state
        );
        if (row == null) {
            return null;
        }
        if (row.usedAt() != null) {
            return null;
        }
        if (row.expiresAt() == null || row.expiresAt().isBefore(Instant.now())) {
            return null;
        }
        int n = jdbc.update(
                """
                UPDATE flutz.mercadopago_oauth_state
                SET used_at = CURRENT_TIMESTAMP
                WHERE oauth_state_id = ? AND used_at IS NULL
                """,
                row.id()
        );
        return n == 1 ? row : null;
    }

    private TokenResponse trocarCodigo(String code, String codeVerifier) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("grant_type", "authorization_code");
        fields.put("client_id", properties.mercadopago().clientId().trim());
        fields.put("client_secret", properties.mercadopago().clientSecret().trim());
        fields.put("code", code);
        fields.put("redirect_uri", redirectUriConfigurado());
        if (AppProperties.hasText(codeVerifier)) {
            fields.put("code_verifier", codeVerifier);
        }
        return postToken(form(fields));
    }

    private TokenResponse renovarToken(String refreshToken) {
        exigirOAuthConfigurado();
        String body = form(
                Map.of(
                        "grant_type", "refresh_token",
                        "client_id", properties.mercadopago().clientId().trim(),
                        "client_secret", properties.mercadopago().clientSecret().trim(),
                        "refresh_token", refreshToken
                )
        );
        return postToken(body);
    }

    private TokenResponse postToken(String formBody) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(TOKEN_URL))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(formBody))
                    .build();
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                // Fallback: alguns ambientes do MP aceitam melhor JSON no /oauth/token
                Map<String, String> asMap = new LinkedHashMap<>();
                for (String part : formBody.split("&")) {
                    int eq = part.indexOf('=');
                    if (eq <= 0) {
                        continue;
                    }
                    asMap.put(
                            java.net.URLDecoder.decode(part.substring(0, eq), StandardCharsets.UTF_8),
                            java.net.URLDecoder.decode(part.substring(eq + 1), StandardCharsets.UTF_8)
                    );
                }
                String jsonBody = json.writeValueAsString(asMap);
                HttpRequest jsonReq = HttpRequest.newBuilder()
                        .uri(URI.create(TOKEN_URL))
                        .timeout(Duration.ofSeconds(20))
                        .header("Content-Type", "application/json")
                        .header("Accept", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                        .build();
                HttpResponse<String> jsonRes = HTTP.send(jsonReq, HttpResponse.BodyHandlers.ofString());
                if (jsonRes.statusCode() >= 200 && jsonRes.statusCode() < 300) {
                    response = jsonRes;
                } else {
                    log.warn("OAuth token MP HTTP form={} json={}: {}", response.statusCode(), jsonRes.statusCode(), truncar(jsonRes.body()));
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, mensagemErroToken(jsonRes.body(), redirectUriConfigurado()));
                }
            }
            JsonNode node = json.readTree(response.body());
            String access = text(node, "access_token");
            if (!AppProperties.hasText(access)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Não foi possível conectar sua conta Mercado Pago. Tente novamente."
                );
            }
            String refresh = text(node, "refresh_token");
            String publicKey = text(node, "public_key");
            String userId = node.hasNonNull("user_id") ? node.get("user_id").asText() : null;
            String scope = text(node, "scope");
            long expiresIn = node.has("expires_in") && node.get("expires_in").canConvertToLong()
                    ? node.get("expires_in").asLong()
                    : 15_552_000L;
            Instant expiresAt = Instant.now().plusSeconds(Math.max(60, expiresIn));
            if (!AppProperties.hasText(publicKey) && AppProperties.hasText(access)) {
                publicKey = buscarPublicKey(access);
            }
            String nome = buscarNomeConta(access);
            return new TokenResponse(access, refresh, publicKey, userId, scope, expiresAt, nome);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Falha ao trocar/renovar token MP: {}", ex.getMessage());
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Não foi possível conectar sua conta Mercado Pago. Tente novamente."
            );
        }
    }

    private String buscarPublicKey(String accessToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.mercadopago.com/users/me"))
                    .timeout(Duration.ofSeconds(12))
                    .header("Authorization", "Bearer " + accessToken)
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode node = json.readTree(response.body());
                // Alguns ambientes expõem public_key em applications; fallback null
                if (node.hasNonNull("public_key")) {
                    return node.get("public_key").asText();
                }
            }
        } catch (Exception ex) {
            log.warn("Não foi possível obter public_key via /users/me: {}", ex.getMessage());
        }
        return null;
    }

    private String buscarNomeConta(String accessToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.mercadopago.com/users/me"))
                    .timeout(Duration.ofSeconds(12))
                    .header("Authorization", "Bearer " + accessToken)
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return null;
            }
            JsonNode node = json.readTree(response.body());
            if (node.hasNonNull("nickname")) {
                return node.get("nickname").asText();
            }
            if (node.hasNonNull("first_name") || node.hasNonNull("last_name")) {
                String first = text(node, "first_name");
                String last = text(node, "last_name");
                return ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
            }
            if (node.hasNonNull("email")) {
                return node.get("email").asText();
            }
        } catch (Exception ex) {
            log.warn("Não foi possível obter nome da conta MP: {}", ex.getMessage());
        }
        return null;
    }

    private void persistirConexao(Integer empresaId, TokenResponse tokens) {
        String publicKey = tokens.publicKey();
        if (!AppProperties.hasText(publicKey)) {
            // Conta conecta mesmo assim; a public_key pode ser preenchida depois via /users/me.
            log.warn("OAuth MP sem public_key na resposta; salvando conexão sem ela (empresa={})", empresaId);
            publicKey = "";
        }
        String accountId = AppProperties.hasText(tokens.userId())
                ? "mp-oauth-" + tokens.userId()
                : "mp-oauth-" + empresaId + "-" + Instant.now().getEpochSecond();
        String nome = AppProperties.hasText(tokens.nomeExibicao())
                ? tokens.nomeExibicao()
                : (AppProperties.hasText(tokens.userId()) ? "Conta " + tokens.userId() : "Mercado Pago");

        jdbc.update(
                """
                UPDATE flutz.conta_pagamento
                SET status_conta = 'DESCONECTADA', disconnected_at = CURRENT_TIMESTAMP
                WHERE empresa_id = ? AND status_conta = 'CONECTADA'
                """,
                empresaId
        );

        Integer existente = jdbc.query(
                """
                SELECT conta_pagamento_id FROM flutz.conta_pagamento
                WHERE empresa_id = ? AND provider = 'mercadopago'
                ORDER BY conta_pagamento_id DESC LIMIT 1
                """,
                rs -> rs.next() ? rs.getInt(1) : null,
                empresaId
        );

        if (existente != null) {
            jdbc.update(
                    """
                    UPDATE flutz.conta_pagamento
                    SET account_id = ?, public_key = ?, access_token = ?, refresh_token = ?,
                        token_expires_at = ?, provider_user_id = ?, oauth_scope = ?,
                        nome_exibicao = ?, auth_mode = 'oauth', status_conta = 'CONECTADA',
                        connected_at = CURRENT_TIMESTAMP, disconnected_at = NULL,
                        ultima_atualizacao = CURRENT_TIMESTAMP
                    WHERE conta_pagamento_id = ?
                    """,
                    accountId,
                    publicKey,
                    tokens.accessToken(),
                    tokens.refreshToken(),
                    Timestamp.from(tokens.expiresAt()),
                    tokens.userId(),
                    tokens.scope(),
                    nome,
                    existente
            );
        } else {
            jdbc.update(
                    """
                    INSERT INTO flutz.conta_pagamento
                      (empresa_id, provider, account_id, status_conta, public_key, access_token,
                       refresh_token, token_expires_at, provider_user_id, oauth_scope,
                       nome_exibicao, auth_mode, connected_at)
                    VALUES (?, 'mercadopago', ?, 'CONECTADA', ?, ?, ?, ?, ?, ?, ?, 'oauth', CURRENT_TIMESTAMP)
                    """,
                    empresaId,
                    accountId,
                    publicKey,
                    tokens.accessToken(),
                    tokens.refreshToken(),
                    Timestamp.from(tokens.expiresAt()),
                    tokens.userId(),
                    tokens.scope(),
                    nome
            );
        }
    }

    private void atualizarTokens(Integer contaId, TokenResponse tokens) {
        jdbc.update(
                """
                UPDATE flutz.conta_pagamento
                SET access_token = ?,
                    refresh_token = COALESCE(?, refresh_token),
                    token_expires_at = ?,
                    public_key = COALESCE(?, public_key),
                    ultima_atualizacao = CURRENT_TIMESTAMP
                WHERE conta_pagamento_id = ?
                """,
                tokens.accessToken(),
                tokens.refreshToken(),
                Timestamp.from(tokens.expiresAt()),
                tokens.publicKey(),
                contaId
        );
    }

    private void marcarExpirada(Integer contaId) {
        jdbc.update(
                """
                UPDATE flutz.conta_pagamento
                SET status_conta = 'DESCONECTADA',
                    disconnected_at = CURRENT_TIMESTAMP,
                    access_token = NULL,
                    refresh_token = NULL,
                    ultima_atualizacao = CURRENT_TIMESTAMP
                WHERE conta_pagamento_id = ?
                """,
                contaId
        );
    }

    private ContaRow carregarConta(Integer empresaId) {
        return jdbc.query(
                """
                SELECT conta_pagamento_id, status_conta, public_key, access_token, refresh_token,
                       token_expires_at, auth_mode
                FROM flutz.conta_pagamento
                WHERE empresa_id = ? AND provider = 'mercadopago'
                ORDER BY conta_pagamento_id DESC
                LIMIT 1
                """,
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    Timestamp exp = rs.getTimestamp("token_expires_at");
                    return new ContaRow(
                            rs.getInt("conta_pagamento_id"),
                            rs.getString("status_conta"),
                            rs.getString("public_key"),
                            rs.getString("access_token"),
                            rs.getString("refresh_token"),
                            exp == null ? null : exp.toInstant(),
                            rs.getString("auth_mode")
                    );
                },
                empresaId
        );
    }

    private static boolean precisaRenovar(ContaRow conta) {
        if (conta.expiresAt() == null) {
            return false;
        }
        return Instant.now().plus(REFRESH_SKEW).isAfter(conta.expiresAt());
    }

    private void exigirOAuthConfigurado() {
        if (!properties.mercadoPagoOAuthConfigured()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Conexão Mercado Pago indisponível no momento. Contate o suporte do Flutz."
            );
        }
    }

    private void exigirAdminClinica() {
        AuthPrincipal auth = AuthHolder.current();
        if (!(auth.temPapel("administrador") || auth.adminPlataforma())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica");
        }
        clinic.empresaAtual();
    }

    private static String novoState() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String novoCodeVerifier() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String codeChallengeS256(String verifier) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Não foi possível gerar PKCE challenge", ex);
        }
    }

    private static String form(Map<String, String> fields) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : fields.entrySet()) {
            if (sb.length() > 0) {
                sb.append('&');
            }
            sb.append(URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8))
                    .append('=')
                    .append(URLEncoder.encode(e.getValue() == null ? "" : e.getValue(), StandardCharsets.UTF_8));
        }
        return sb.toString();
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) {
            return null;
        }
        String v = node.get(field).asText();
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String mensagemErroToken(String body, String redirectUriEsperado) {
        String lower = body == null ? "" : body.toLowerCase(Locale.ROOT);
        if (lower.contains("redirect_uri") || lower.contains("redirect uri")) {
            return "Redirect URI não confere com a do painel MP. Cadastre também: " + redirectUriEsperado;
        }
        if (lower.contains("invalid_client") || lower.contains("client_id") || lower.contains("client_secret")) {
            return "Client ID ou Client Secret inválidos no servidor. Confira Detalhes da aplicação no painel MP.";
        }
        if (lower.contains("invalid_grant") || lower.contains("authorization code")) {
            return "Código de autorização inválido ou já usado. Clique em Conectar de novo (não recarregue a página do callback).";
        }
        if (lower.contains("code_verifier") || lower.contains("pkce")) {
            return "Falha no PKCE. Confirme que o app no Mercado Pago está com authorization code + PKCE habilitado.";
        }
        return "Não foi possível conectar sua conta Mercado Pago. Tente novamente.";
    }

    private static String truncar(String body) {
        if (body == null) {
            return "";
        }
        String limpo = body.replaceAll("(?i)(access_token|refresh_token|client_secret)\"\\s*:\\s*\"[^\"]+\"", "$1\":\"***\"");
        return limpo.length() > 400 ? limpo.substring(0, 400) + "…" : limpo;
    }

    public record ConnectStart(String authorizationUrl, String expiresAt, String redirectUri) {
    }

    public record CallbackResult(String redirectUrl) {
        static CallbackResult redirect(String url) {
            return new CallbackResult(url);
        }
    }

    private record StateRow(
            int id,
            int empresaId,
            int atorId,
            Instant expiresAt,
            Instant usedAt,
            String codeVerifier
    ) {
    }

    private record ContaRow(
            int id,
            String status,
            String publicKey,
            String accessToken,
            String refreshToken,
            Instant expiresAt,
            String authMode
    ) {
    }

    private record TokenResponse(
            String accessToken,
            String refreshToken,
            String publicKey,
            String userId,
            String scope,
            Instant expiresAt,
            String nomeExibicao
    ) {
    }
}
