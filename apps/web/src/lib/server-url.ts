import { env } from "@pujo-map/env/web";

const defaultServerUrl = "http://localhost:3000";

function resolveServerUrl() {
  return new URL(env.VITE_SERVER_URL ?? defaultServerUrl);
}

export function getServerUrl() {
  return resolveServerUrl();
}

export function getWebSocketUrl() {
  const url = new URL(env.VITE_WS_URL ?? resolveServerUrl().toString());

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";

  return url;
}
