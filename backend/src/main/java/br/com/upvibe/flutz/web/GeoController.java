package br.com.upvibe.flutz.web;

import java.math.BigDecimal;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.geo.GeoLookupService;

@RestController
public class GeoController {

    private final GeoLookupService geo;

    public GeoController(GeoLookupService geo) {
        this.geo = geo;
    }

    @GetMapping("/api/geo/reverso")
    public GeoLookupService.EnderecoSugerido reverso(
            @RequestParam BigDecimal lat,
            @RequestParam BigDecimal lng
    ) {
        return geo.reverso(lat, lng);
    }
}
