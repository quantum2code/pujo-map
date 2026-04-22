import fastifyCors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { baseCorsConfig } from "./config/cors";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import messageRoutes from "./routes/message";
import websocketRoutes from "./routes/websocket";

const fastify = Fastify({
  logger: true,
});

fastify.decorate("wsClients", new Set<WebSocket>());
fastify.decorate("broadcast", (data: unknown) => {
  const msg = JSON.stringify(data);

  for (const client of fastify.wsClients) {
    client.send(msg);
  }
});

fastify.register(fastifyCors, baseCorsConfig);
fastify.register(authPlugin);
await fastify.register(websocket);

fastify.register(authRoutes);
fastify.register(messageRoutes);
fastify.register(websocketRoutes);

fastify.get("/", async () => {
  return "OK";
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log("Server running on port 3000");
});
