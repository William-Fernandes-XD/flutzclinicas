package br.com.upvibe.flutz.billing;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.config.AppProperties;

@Component
public class MercadoPagoWebhookValidator {

    private static final Logger log = LoggerFactory.getLogger(MercadoPagoWebhookValidator.class);

    private final AppProperties properties;

    public MercadoPagoWebhookValidator(AppProperties properties) {
        this.properties = properties;
    }

    public void validar(String xSignature, String xRequestId, String dataId) {
        String secret = properties.mercadopago() == null ? null : properties.mercadopago().webhookSecret();
        if (secret == null || secret.isBlank()) {
            if (properties.production()) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Webhook não configurado");
            }
            log.warn("MERCADOPAGO_WEBHOOK_SECRET vazio — validação de webhook desativada (desenvolvimento).");
            return;
        }
        if (xSignature == null || xSignature.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Assinatura do webhook ausente");
        }
        String ts = null;
        String hash = null;
        for (String part : xSignature.split(",")) {
            String[] kv = part.split("=", 2);
            if (kv.length != 2) {
                continue;
            }
            if ("ts".equals(kv[0].trim())) {
                ts = kv[1].trim();
            } else if ("v1".equals(kv[0].trim())) {
                hash = kv[1].trim();
            }
        }
        if (ts == null || ts.isBlank() || hash == null || hash.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Assinatura do webhook inválida");
        }
        StringBuilder manifest = new StringBuilder();
        if (dataId != null && !dataId.isBlank()) {
            manifest.append("id:").append(dataId.toLowerCase(Locale.ROOT)).append(";");
        }
        if (xRequestId != null && !xRequestId.isBlank()) {
            manifest.append("request-id:").append(xRequestId).append(";");
        }
        manifest.append("ts:").append(ts).append(";");
        String expected = hmac(secret, manifest.toString());
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), hash.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Assinatura do webhook inválida");
        }
    }

    private static String hmac(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao validar webhook");
        }
    }
}
