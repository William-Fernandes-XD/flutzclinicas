package br.com.upvibe.flutz.web;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import jakarta.annotation.PreDestroy;

@RestController
@RequestMapping("/api/notificacoes")
public class NotificationController {

    private static final Logger log = LoggerFactory.getLogger(NotificationController.class);

    /** Timeout longo ok; o custo real é o poll no DB — manter intervalo alto. */
    private static final long SSE_TIMEOUT_MS = 30L * 60L * 1000L;
    private static final long SSE_POLL_SECONDS = 20L;
    /** Teto de conexões SSE simultâneas no processo (protege pool Hikari/Tomcat). */
    private static final int SSE_MAX_CONEXOES = 150;

    private final NotificationService notifications;
    private final AtomicInteger sseAtivas = new AtomicInteger(0);
    /** Scheduler compartilhado — evita criar uma thread por conexão SSE. */
    private final ScheduledExecutorService sseScheduler = Executors.newScheduledThreadPool(
            4,
            r -> {
                Thread t = new Thread(r, "notif-sse");
                t.setDaemon(true);
                return t;
            }
    );

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @PreDestroy
    void shutdownSse() {
        sseScheduler.shutdownNow();
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
     * Stream leve: emite quando a contagem de não lidas muda.
     * Poll no servidor a cada ~20s (não a cada poucos segundos).
     */
    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        AuthPrincipal auth = AuthHolder.optional();
        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sessão ausente");
        }
        if (!auth.tutor() && !auth.colaborador() && !auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão");
        }
        Integer destId = auth.atorId();
        if (destId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão");
        }
        if (sseAtivas.get() >= SSE_MAX_CONEXOES) {
            log.warn("SSE notificações: limite de {} conexões atingido — recusando", SSE_MAX_CONEXOES);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Muitas conexões de notificação");
        }
        String destTipo = notifications.destinatarioTipoPublico(auth);

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        AtomicLong ultimo = new AtomicLong(-1);
        AtomicBoolean closed = new AtomicBoolean(false);
        ScheduledFuture<?>[] pollRef = new ScheduledFuture<?>[1];
        sseAtivas.incrementAndGet();

        Runnable markClosed = () -> {
            if (!closed.compareAndSet(false, true)) {
                return;
            }
            sseAtivas.decrementAndGet();
            ScheduledFuture<?> poll = pollRef[0];
            if (poll != null) {
                poll.cancel(false);
            }
        };

        pollRef[0] = sseScheduler.scheduleAtFixedRate(() -> {
            if (closed.get()) {
                return;
            }
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
                // Cliente/proxy encerrou. NÃO chamar emitter.complete():
                // complete() tenta flush e gera AsyncRequestNotUsableException.
                markClosed.run();
            } catch (Exception ex) {
                if (isClientGone(ex)) {
                    markClosed.run();
                    return;
                }
                log.debug("SSE notificações: falha ao emitir para {}/{}: {}", destTipo, destId, ex.getMessage());
                markClosed.run();
            }
        }, 0, SSE_POLL_SECONDS, TimeUnit.SECONDS);

        emitter.onCompletion(markClosed);
        emitter.onTimeout(() -> {
            markClosed.run();
            try {
                emitter.complete();
            } catch (Exception ignored) {
                /* proxy já fechou */
            }
        });
        emitter.onError(ex -> markClosed.run());

        return emitter;
    }

    private static boolean isClientGone(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            String name = t.getClass().getName();
            if (name.contains("AsyncRequestNotUsableException")
                    || name.contains("ClientAbortException")
                    || name.contains("EofException")) {
                return true;
            }
            if (t instanceof IOException) {
                return true;
            }
        }
        return false;
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
