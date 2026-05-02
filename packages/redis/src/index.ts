import { createClient } from "redis";

let client: ReturnType<typeof createClient>;
function getRedisClient() {
  if (!client) {
    client = createClient({
      url: "redis://localhost:6379",
    });

    client.on("error", (err) => {
      console.error("redis client error: ", err);
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
