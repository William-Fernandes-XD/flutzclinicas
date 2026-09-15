package br.com.upvibe.flutz.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
public class PublicHealthController {

    @GetMapping("/health-message")
    public Map<String, String> healthMessage() {
        return Map.of("status", "ok");
    }
}
