package br.com.upvibe.flutz.billing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.mercadopago.MercadoPagoConfig;
import com.mercadopago.client.common.IdentificationRequest;
import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.client.payment.PaymentCreateRequest;
import com.mercadopago.client.payment.PaymentPayerRequest;
import com.mercadopago.core.MPRequestOptions;
import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.resources.payment.Payment;

import br.com.upvibe.flutz.config.AppProperties;
import jakarta.annotation.PostConstruct;

@Service
public class MercadoPagoService {

    private static final Logger log = LoggerFactory.getLogger(MercadoPagoService.class);
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();

    private final AppProperties properties;
    private final PaymentClient paymentClient = new PaymentClient();

    public MercadoPagoService(AppProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() {
        if (properties.mercadoPagoConfigured()) {
            MercadoPagoConfig.setAccessToken(properties.mercadopago().accessToken());
            log.info("Mercado Pago configurado para mensalidade da clínica");
        } else {
            log.warn("Mercado Pago não configurado — defina MERCADOPAGO_PUBLIC_KEY e MERCADOPAGO_ACCESS_TOKEN");
        }
    }

    public String publicKey() {
        return properties.mercadopago() == null ? null : properties.mercadopago().publicKey();
    }

    /** Valida Access Token chamando /users/me (sem gravar segredo em log). */
    public void validarCredenciaisClinica(String publicKey, String accessToken) {
        String pk = limparKey(publicKey);
        String token = limparKey(accessToken);
        if (pk == null || token == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a Public Key e o Access Token do Mercado Pago");
        }
        if (!(pk.startsWith("TEST-") || pk.startsWith("APP_USR-"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Public Key inválida. Use a chave que começa com TEST- ou APP_USR-");
        }
        if (!(token.startsWith("TEST-") || token.startsWith("APP_USR-"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Access Token inválido. Use o token que começa com TEST- ou APP_USR-");
        }
        boolean pkTest = pk.startsWith("TEST-");
        boolean tokTest = token.startsWith("TEST-");
        if (pkTest != tokTest) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Public Key e Access Token precisam ser do mesmo ambiente (ambos teste ou ambos produção)"
            );
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.mercadopago.com/users/me"))
                    .timeout(Duration.ofSeconds(12))
                    .header("Authorization", "Bearer " + token)
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 401 || response.statusCode() == 403) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Access Token rejeitado pelo Mercado Pago. Confira se copiou o token completo da conta da clínica."
                );
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Validação MP /users/me status={}", response.statusCode());
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Não foi possível validar o Access Token no Mercado Pago (HTTP " + response.statusCode() + ")."
                );
            }
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Falha ao validar credenciais MP: {}", ex.getMessage());
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Não foi possível falar com o Mercado Pago para validar as chaves. Tente de novo."
            );
        }
    }

    public Payment criarPix(BigDecimal valor, String descricao, String referencia, Pagador pagador) {
        return criarPix(valor, descricao, referencia, pagador, null);
    }

    public Payment criarPix(BigDecimal valor, String descricao, String referencia, Pagador pagador, String accessToken) {
        String token = resolverToken(accessToken);
        try {
            PaymentCreateRequest request = PaymentCreateRequest.builder()
                    .transactionAmount(money(valor))
                    .description(descricao)
                    .paymentMethodId("pix")
                    .externalReference(referencia)
                    .payer(payer(pagador))
                    .build();
            return paymentClient.create(request, options(token));
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (MPApiException ex) {
            throw traduzirErroMp("PIX", ex);
        } catch (Exception ex) {
            log.error("Erro PIX Mercado Pago: {}", ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível gerar o PIX. Tente de novo.");
        }
    }

    public Payment criarCartao(BigDecimal valor, String descricao, String referencia, CardPaymentRequest card) {
        return criarCartao(valor, descricao, referencia, card, null);
    }

    public Payment criarCartao(BigDecimal valor, String descricao, String referencia, CardPaymentRequest card, String accessToken) {
        String token = resolverToken(accessToken);
        try {
            PaymentCreateRequest.PaymentCreateRequestBuilder builder = PaymentCreateRequest.builder()
                    .transactionAmount(money(valor))
                    .description(descricao)
                    .token(card.token())
                    .installments(card.installments() == null ? 1 : card.installments())
                    .paymentMethodId(card.paymentMethodId())
                    .externalReference(referencia)
                    .payer(PaymentPayerRequest.builder()
                            .email(card.payerEmail())
                            .firstName(primeiroNome(card.payerName()))
                            .lastName(ultimoNome(card.payerName()))
                            .identification(IdentificationRequest.builder()
                                    .type("CPF")
                                    .number(soDigitos(card.payerCpf()))
                                    .build())
                            .build());
            if (card.issuerId() != null && !card.issuerId().isBlank()) {
                builder.issuerId(card.issuerId());
            }
            return paymentClient.create(builder.build(), options(token));
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (MPApiException ex) {
            throw traduzirErroMp("cartão", ex);
        } catch (Exception ex) {
            log.error("Erro cartão Mercado Pago: {}", ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível processar o cartão. Verifique os dados.");
        }
    }

    public Payment consultar(String paymentId) {
        return consultar(paymentId, null);
    }

    public Payment consultar(String paymentId, String accessToken) {
        String token = resolverToken(accessToken);
        try {
            return paymentClient.get(Long.parseLong(paymentId), options(token));
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (MPApiException ex) {
            throw traduzirErroMp("consulta", ex);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível consultar o pagamento.");
        }
    }

    private String resolverToken(String accessToken) {
        String token = limparKey(accessToken);
        if (token != null) {
            return token;
        }
        if (!properties.mercadoPagoConfigured()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Pagamento indisponível no momento. Tente de novo em instantes."
            );
        }
        return limparKey(properties.mercadopago().accessToken());
    }

    private MPRequestOptions options(String accessToken) {
        return MPRequestOptions.builder()
                .accessToken(accessToken)
                .customHeaders(Map.of("X-Idempotency-Key", UUID.randomUUID().toString()))
                .build();
    }

    private ResponseStatusException traduzirErroMp(String contexto, MPApiException ex) {
        String body = ex.getApiResponse() == null ? null : ex.getApiResponse().getContent();
        int status = ex.getStatusCode();
        log.error("Erro Mercado Pago ({}) HTTP {}: {}", contexto, status, body);
        String detalhe = extrairMensagem(body);
        if (status == 401 || status == 403) {
            return new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Credenciais da clínica rejeitadas pelo Mercado Pago. Conecte a conta novamente em Financeiro."
            );
        }
        if (detalhe != null && !detalhe.isBlank()) {
            return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Mercado Pago: " + detalhe);
        }
        return new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Não foi possível gerar o " + contexto + " no Mercado Pago. Verifique a conexão da clínica e tente de novo."
        );
    }

    private static String extrairMensagem(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        String lower = body.toLowerCase(Locale.ROOT);
        if (lower.contains("unauthorized") || lower.contains("invalid access token")) {
            return "Access Token inválido ou sem permissão";
        }
        if (lower.contains("collector") && lower.contains("not") && lower.contains("pix")) {
            return "A conta Mercado Pago da clínica ainda não está habilitada para receber PIX";
        }
        if (lower.contains("transaction_amount") || lower.contains("invalid_amount")) {
            return "Valor inválido para cobrança";
        }
        if (lower.contains("payer") && lower.contains("email")) {
            return "E-mail do pagador inválido";
        }
        // tenta message do JSON de forma simples
        int idx = body.indexOf("\"message\"");
        if (idx >= 0) {
            int start = body.indexOf(':', idx);
            int quote1 = body.indexOf('"', start + 1);
            int quote2 = quote1 >= 0 ? body.indexOf('"', quote1 + 1) : -1;
            if (quote1 >= 0 && quote2 > quote1) {
                return body.substring(quote1 + 1, quote2);
            }
        }
        return null;
    }

    private PaymentPayerRequest payer(Pagador pagador) {
        if (pagador.email() == null || pagador.email().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o e-mail para pagar");
        }
        if (soDigitos(pagador.cpf()).length() != 11) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um CPF válido para pagar");
        }
        return PaymentPayerRequest.builder()
                .email(pagador.email())
                .firstName(primeiroNome(pagador.nome()))
                .lastName(ultimoNome(pagador.nome()))
                .identification(IdentificationRequest.builder()
                        .type("CPF")
                        .number(soDigitos(pagador.cpf()))
                        .build())
                .build();
    }

    private static String limparKey(String value) {
        if (value == null) {
            return null;
        }
        String limpo = value.replaceAll("\\s+", "").trim();
        return limpo.isEmpty() ? null : limpo;
    }

    private static BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private static String primeiroNome(String nome) {
        if (nome == null || nome.isBlank()) {
            return "Tutor";
        }
        return nome.trim().split("\\s+")[0];
    }

    private static String ultimoNome(String nome) {
        if (nome == null || nome.isBlank()) {
            return "Flutz";
        }
        String[] parts = nome.trim().split("\\s+");
        return parts.length > 1 ? parts[parts.length - 1] : "Flutz";
    }

    private static String soDigitos(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    public record Pagador(String nome, String email, String cpf) {
    }

    public record CardPaymentRequest(
            String token,
            String paymentMethodId,
            Integer installments,
            String issuerId,
            String payerEmail,
            String payerName,
            String payerCpf
    ) {
    }
}
