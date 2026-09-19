package br.com.upvibe.flutz.clinic;

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

    public NotificationScheduler(NotificationService notifications, TokenBillingService billing) {
        this.notifications = notifications;
        this.billing = billing;
    }

    /** Vacinas: todo dia às 23:59 (horário de Brasília) — D-3 e D-1. */
    @Scheduled(cron = "0 59 23 * * *", zone = "America/Sao_Paulo")
    public void vacinasDiarias() {
        try {
            int n = notifications.processarVacinasProximas();
            log.info("Notificações de vacina geradas: {}", n);
        } catch (Exception ex) {
            log.error("Falha ao processar notificações de vacina", ex);
        }
    }

    /** Assinatura D-3: todo dia às 08:00 (horário de Brasília). */
    @Scheduled(cron = "0 0 8 * * *", zone = "America/Sao_Paulo")
    public void assinaturaD3Diaria() {
        try {
            int n = notifications.processarAssinaturaD3();
            if (n > 0) {
                log.info("Notificações de assinatura D-3 geradas: {}", n);
            }
        } catch (Exception ex) {
            log.error("Falha ao processar notificações de assinatura D-3", ex);
        }
    }

    /** Bloqueio por inadimplência: todo dia às 01:00 (horário de Brasília). */
    @Scheduled(cron = "0 0 1 * * *", zone = "America/Sao_Paulo")
    public void inadimplenciaDiaria() {
        try {
            int n = billing.processarInadimplencia();
            if (n > 0) {
                log.info("Assinaturas bloqueadas por inadimplência: {}", n);
            }
        } catch (Exception ex) {
            log.error("Falha ao processar inadimplência", ex);
        }
    }

    /** Lembretes D-1 (amanhã) e H-1 do veterinário. */
    @Scheduled(cron = "0 */10 * * * *", zone = "America/Sao_Paulo")
    public void lembretesAtendimento() {
        try {
            int n = notifications.processarLembretesAtendimento();
            if (n > 0) {
                log.info("Lembretes de atendimento gerados: {}", n);
            }
        } catch (Exception ex) {
            log.error("Falha ao processar lembretes de atendimento", ex);
        }
    }
}