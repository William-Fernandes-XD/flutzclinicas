package br.com.upvibe.flutz.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class RetryLaterException extends ResponseStatusException {

    private final long retryAfterSeconds;

    public RetryLaterException(HttpStatus status, String message, long retryAfterSeconds) {
        super(status, message);
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
