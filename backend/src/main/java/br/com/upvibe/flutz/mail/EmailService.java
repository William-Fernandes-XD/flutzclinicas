package br.com.upvibe.flutz.mail;

public interface EmailService {

    void send(String to, String subject, String body);

    /** Envia corpo HTML (multipart simples). */
    default void sendHtml(String to, String subject, String htmlBody) {
        send(to, subject, htmlBody);
    }
}
