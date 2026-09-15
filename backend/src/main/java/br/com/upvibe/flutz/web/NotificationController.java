package br.com.upvibe.flutz.web;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.upvibe.flutz.clinic.NotificationService;

@RestController
@RequestMapping("/api/notificacoes")
public class NotificationController {

    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public List<NotificationService.NotificacaoItem> listar() {
        return notifications.minhas();
    }

    @GetMapping("/nao-lidas")
    public Map<String, Long> naoLidas() {
        return Map.of("total", notifications.naoLidas());
    }

    @PostMapping("/{id}/lida")
    public NotificationService.NotificacaoItem marcarLida(@PathVariable Integer id) {
        return notifications.marcarLida(id);
    }

    @PostMapping("/lidas")
    public Map<String, String> marcarTodas() {
        notifications.marcarTodasLidas();
        return Map.of("status", "ok");
    }

    @GetMapping("/logs")
    public List<NotificationService.LogNotificacao> logs() {
        return notifications.logsClinica();
    }
}
