import { createAuthClient } from "better-auth/react";
import { env } from "@pujo-map/env/web";

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
});
