import { env } from "@pujo-map/env/web";

export function getServerUrl() {
  const url = new URL(env.VITE_SERVER_URL);

  return url;
}

export function getWebSocketUrl() {
  const url = new URL(env.VITE_WS_URL ?? env.VITE_SERVER_URL);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";

  return url;
}
