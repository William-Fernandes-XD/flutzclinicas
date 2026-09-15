package br.com.upvibe.flutz.exception;

import java.time.Instant;

public record ApiErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path,
        Long retryAfterSeconds
) {
}
