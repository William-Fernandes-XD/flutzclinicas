package br.com.upvibe.flutz.geo;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import br.com.upvibe.flutz.security.AuthHolder;

@Service
public class GeoLookupService {

    private static final Logger log = LoggerFactory.getLogger(GeoLookupService.class);

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();
    private final ObjectMapper mapper;

    public GeoLookupService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public EnderecoSugerido reverso(BigDecimal lat, BigDecimal lng) {
        AuthHolder.current();
        if (lat == null || lng == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe latitude e longitude");
        }
        URI uri = URI.create(
                "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat="
                        + lat.toPlainString()
                        + "&lon="
                        + lng.toPlainString()
        );
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(8))
                .header("Accept", "application/json")
                .header("User-Agent", "Flutz/1.0 (localizacao da clinica)")
                .GET()
                .build();
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível obter o endereço desta posição.");
            }
            JsonNode root = mapper.readTree(response.body());
            JsonNode address = root.path("address");
            String uf = ufDe(address);
            return new EnderecoSugerido(
                    lat,
                    lng,
                    text(address, "road", "pedestrian", "footway"),
                    text(address, "house_number"),
                    text(address, "suburb", "neighbourhood", "quarter"),
                    text(address, "city", "town", "village", "municipality"),
                    uf,
                    digits(text(address, "postcode")),
                    text(root, "display_name")
            );
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Reverse geocode failed", ex);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível obter o endereço desta posição.");
        }
    }

    private static String ufDe(JsonNode address) {
        String iso = text(address, "ISO3166-2-lvl4");
        if (iso != null && iso.contains("-")) {
            String sigla = iso.substring(iso.indexOf('-') + 1).toUpperCase();
            if (sigla.length() == 2) {
                return sigla;
            }
        }
        return null;
    }

    private static String text(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode value = node.get(key);
            if (value != null && !value.isNull() && !value.asText().isBlank()) {
                return value.asText().trim();
            }
        }
        return null;
    }

    private static String digits(String value) {
        if (value == null) {
            return null;
        }
        String only = value.replaceAll("\\D", "");
        return only.isBlank() ? null : only;
    }

    public record EnderecoSugerido(
            BigDecimal latitude,
            BigDecimal longitude,
            String logradouro,
            String numero,
            String bairro,
            String cidade,
            String uf,
            String cep,
            String descricao
    ) {
    }
}
