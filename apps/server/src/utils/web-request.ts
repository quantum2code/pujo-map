import type { FastifyRequest } from "fastify";

export function toWebHeaders(headers: FastifyRequest["headers"]): Headers {
  const webHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        webHeaders.append(key, entry);
      }
      continue;
    }

    if (value) {
      webHeaders.append(key, value.toString());
    }
  }

  return webHeaders;
}

export function toWebRequest(request: FastifyRequest): Request {
  const url = new URL(request.url, `http://${request.headers.host}`);

  return new Request(url.toString(), {
    method: request.method,
    headers: toWebHeaders(request.headers),
    body: request.body ? JSON.stringify(request.body) : undefined,
  });
}
