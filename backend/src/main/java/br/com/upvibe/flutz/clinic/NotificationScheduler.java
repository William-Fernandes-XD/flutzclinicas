package br.com.upvibe.flutz.clinic;

import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import br.com.upvibe.flutz.billing.TokenBillingService;

@Component
public class NotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationScheduler.class);

    private final NotificationService notifications;
    private final TokenBillingService billing;

    /** Evita sobreposição se um job atrasar (pool padrão do Spring é single-thread). */
    private final AtomicBoolean lembretesH1Rodando = new AtomicBoolean(false);
    private final AtomicBoolean lembretesD1Rodando = new AtomicBoolean(false);
    private final AtomicBoolean vacinasRodando = new AtomicBoolean(false);
    private final AtomicBoolean assinaturaRodando = new AtomicBoolean(false);
    private final AtomicBoolean inadimplenciaRodando = new AtomicBoolean(false);

    public NotificationScheduler(NotificationService notifications, TokenBillingService billing) {
        this.notifications = notifications;
        this.billing = billing;
    }

    /** Vacinas: todo dia às 23:59 (horário de Brasília) — D-3 e D-1. */
    @Scheduled(cron = "0 59 23 * * *", zone = "America/Sao_Paulo")
    public void vacinasDiarias() {
        if (!vacinasRodando.compareAndSet(false, true)) {
            log.warn("Job de vacinas ainda em execução — pulando ciclo");
            return;
        }
        try {
            int n = notifications.processarVacinasProximas();
            log.info("Notificações de vacina geradas: {}", n);
        } catch (Exception ex) {
            log.error("Falha ao processar notificações de vacina", ex);
        } finally {
            vacinasRodando.set(false);
        }
    }

    /** Assinatura D-3: todo dia às 08:00 (horário de Brasília). */
    @Scheduled(cron = "0 0 8 * * *", zone = "America/Sao_Paulo")
    public void assinaturaD3Diaria() {
        if (!assinaturaRodando.compareAndSet(false, true)) {
            log.warn("Job de assinatura D-3 ainda em execução — pulando ciclo");
            return;
        }
        try {
            int n = notifications.processarAssinaturaD3();
            if (n > 0) {
                log.info("Notificações de assinatura D-3 geradas: {}", n);
            }
        } catch (Exception ex) {
            log.error("Falha ao processar notificações de assinatura D-3", ex);
        } finally {
            assinaturaRodando.set(false);
        }
    }

    /** Bloqueio por inadimplência: todo dia às 01:00 (horário de Brasília). */
    @Scheduled(cron = "0 0 1 * * *", zone = "America/Sao_Paulo")
    public void inadimplenciaDiaria() {
        if (!inadimplenciaRodando.compareAndSet(false, true)) {
            log.warn("Job de inadimplência ainda em execução — pulando ciclo");
            return;
        }
        try {
            int n = billing.processarInadimplencia();
            if (n > 0) {
                log.info("Assinaturas bloqueadas por inadimplência: {}", n);
            }
        } catch (Exception ex) {
            log.error("Falha ao processar inadimplência", ex);
        } finally {
            inadimplenciaRodando.set(false);
        }
    }

    /**
     * Lembrete D-1 (amanhã): uma vez por dia pela manhã.
     * Antes rodava a cada 10 min e reprocessava o mesmo conjunto o dia inteiro.
     */
    @Scheduled(cron = "0 0 7 * * *", zone = "America/Sao_Paulo")
    public void lembretesAtendimentoD1() {
        if (!lembretesD1Rodando.compareAndSet(false, true)) {
            log.warn("Job D-1 ainda em execução — pulando ciclo");
            return;
        }
        try {
            int n = notifications.processarLembretesAtendimentoD1();
            if (n > 0) {
                log.info("Lembretes D-1 de atendimento gerados: {}", n);
            }
        } catch (Exception ex) {
            log.error("Falha ao processar lembretes D-1 de atendimento", ex);
        } finally {
            lembretesD1Rodando.set(false);
        }
    }

    /** Lembrete H-1 do veterinário: janela estreita, precisa de frequência. */
    @Scheduled(cron = "0 */10 * * * *", zone = "America/Sao_Paulo")
    public void lembretesAtendimentoH1() {
        if (!lembretesH1Rodando.compareAndSet(false, true)) {
            log.warn("Job H-1 ainda em execução — pulando ciclo");
            return;
        }
        try {
            int n = notifications.processarLembretesAtendimentoH1();
            if (n > 0) {
                log.info("Lembretes H-1 de atendimento gerados: {}", n);
            }
        } catch (Exception ex) {
            log.error("Falha ao processar lembretes H-1 de atendimento", ex);
        } finally {
            lembretesH1Rodando.set(false);
        }
    }
}
