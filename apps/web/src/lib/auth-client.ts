import { createAuthClient } from "better-auth/react";
import { env } from "@pujo-map/env/web";
import { getServerUrl } from "./server-url";

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL ?? getServerUrl().toString(),
});
