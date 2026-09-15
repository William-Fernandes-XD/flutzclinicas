package br.com.upvibe.flutz.mail;

public interface EmailService {

    void send(String to, String subject, String body);
}
