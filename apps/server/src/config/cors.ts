import { allowedOrigins, env } from "@pujo-map/env/server";

export const baseCorsConfig = {
  origin(
    origin: string | undefined,
    callback: (error: Error | null, allow: boolean) => void,
  ) {
    if (!origin || env.NODE_ENV === "development") {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.includes(origin));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
};
