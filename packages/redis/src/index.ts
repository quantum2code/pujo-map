import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let client: ReturnType<typeof createClient>;

function getRedisClient() {
  if (!client) {
    client = createClient({ url: REDIS_URL });

    client.on("error", (err) => {
      console.error("Redis client error:", err);
    });
  }

  return client;
}

export async function connectRedis(): Promise<ReturnType<typeof createClient>> {
  const client = getRedisClient();

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}
