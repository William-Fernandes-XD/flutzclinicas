package br.com.upvibe.flutz.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import br.com.upvibe.flutz.config.AppProperties;
import jakarta.mail.internet.MimeMessage;

@Service
public class SmtpEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailService.class);

    private final AppProperties properties;
    private final Environment environment;
    private final ObjectProvider<JavaMailSender> mailSender;

    public SmtpEmailService(
            AppProperties properties,
            Environment environment,
            ObjectProvider<JavaMailSender> mailSender
    ) {
        this.properties = properties;
        this.environment = environment;
        this.mailSender = mailSender;
    }

    @Override
    public void send(String to, String subject, String body) {
        sendInternal(to, subject, body, false);
    }

    @Override
    public void sendHtml(String to, String subject, String htmlBody) {
        sendInternal(to, subject, htmlBody, true);
    }

    private void sendInternal(String to, String subject, String body, boolean html) {
        if (!ready()) {
            log.warn("Mail is not configured. Skipping message to {}", mask(to));
            return;
        }
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            log.warn("Mail sender is unavailable. Skipping message to {}", mask(to));
            return;
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            String from = properties.mail().from();
            String name = properties.mail().fromName();
            if (AppProperties.hasText(name)) {
                helper.setFrom(from, name);
            } else {
                helper.setFrom(from);
            }
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, html);
            sender.send(message);
            log.info("Mail sent to {} subject={}", mask(to), subject);
        } catch (Exception ex) {
            log.error("Failed to send mail to {}", mask(to), ex);
            throw new IllegalStateException("Não foi possível enviar o e-mail agora.");
        }
    }

    private boolean ready() {
        return AppProperties.hasText(environment.getProperty("MAIL_HOST")) && properties.mailConfigured();
    }

    private static String mask(String to) {
        if (to == null || !to.contains("@")) {
            return "***";
        }
        int at = to.indexOf('@');
        return to.charAt(0) + "***" + to.substring(at);
    }
}
