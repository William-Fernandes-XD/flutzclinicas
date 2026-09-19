package br.com.upvibe.flutz.web;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import br.com.upvibe.flutz.clinic.NotificationService;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@RestController
@RequestMapping("/api/notificacoes")
public class NotificationController {

    private static final long SSE_TIMEOUT_MS = 30L * 60L * 1000L;
    private static final long SSE_POLL_SECONDS = 4L;

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

    /**
     * Stream leve: mantém a conexão e emite quando a contagem de não lidas muda
     * (checagem no servidor a cada poucos segundos).
     */
    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth == null || (!auth.tutor() && !auth.colaborador() && !auth.adminPlataforma())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão");
        }
        Integer destId = auth.atorId();
        if (destId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão");
        }
        String destTipo = notifications.destinatarioTipoPublico(auth);

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "notif-sse-" + destTipo + "-" + destId);
            t.setDaemon(true);
            return t;
        });
        AtomicLong ultimo = new AtomicLong(-1);

        ScheduledFuture<?> future = executor.scheduleAtFixedRate(() -> {
            try {
                long total = notifications.contarNaoLidas(destTipo, destId);
                if (total != ultimo.get()) {
                    ultimo.set(total);
                    emitter.send(SseEmitter.event()
                            .name("notificacoes")
                            .data(Map.of("naoLidas", total)));
                } else {
                    emitter.send(SseEmitter.event().comment("ping"));
                }
            } catch (IOException ex) {
                emitter.completeWithError(ex);
            } catch (Exception ex) {
                emitter.completeWithError(ex);
            }
        }, 0, SSE_POLL_SECONDS, TimeUnit.SECONDS);

        Runnable shutdown = () -> {
            future.cancel(true);
            executor.shutdownNow();
        };
        emitter.onCompletion(shutdown);
        emitter.onTimeout(() -> {
            shutdown.run();
            emitter.complete();
        });
        emitter.onError(ex -> shutdown.run());

        return emitter;
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
