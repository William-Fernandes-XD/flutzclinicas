import { env } from "./env";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, code: string, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function mapHttpStatus(status: number): string {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "TOO_MANY_REQUESTS";
  if (status >= 500) return "INTERNAL_ERROR";
  return "HTTP_ERROR";
}

type HttpOptions = RequestInit & {
  json?: unknown;
};

function readRetryAfter(response: Response, body: { retryAfterSeconds?: unknown }): number | undefined {
  const fromBody = Number(body.retryAfterSeconds);
  if (Number.isFinite(fromBody) && fromBody > 0) {
    return Math.ceil(fromBody);
  }
  const header = Number(response.headers.get("Retry-After"));
  if (Number.isFinite(header) && header > 0) {
    return Math.ceil(header);
  }
  return undefined;
}

export function waitMessage(seconds: number): string {
  if (seconds <= 1) {
    return "Aguarde 1 segundo para a próxima tentativa.";
  }
  return `Aguarde ${seconds} segundos para a próxima tentativa.`;
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options;

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!response.ok) {
    let message = "Não foi possível concluir a solicitação.";
    let retryAfterSeconds: number | undefined;
    try {
      const body = (await response.json()) as { message?: string; retryAfterSeconds?: number };
      retryAfterSeconds = readRetryAfter(response, body);
      if (body.message) {
        message = body.message === "Unexpected error"
          ? "Não foi possível concluir. Tente de novo."
          : body.message;
      }
    } catch {
      retryAfterSeconds = readRetryAfter(response, {});
    }
    if (
      response.status === 401
      && !retryAfterSeconds
      && (path.includes("/api/auth/login") || /unauthorized|unexpected error/i.test(message))
    ) {
      message = "Não foi possível entrar. Verifique e-mail ou CPF e a senha.";
    }
    throw new HttpError(response.status, mapHttpStatus(response.status), message, retryAfterSeconds);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
