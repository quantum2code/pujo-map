import fastifyCors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { baseCorsConfig } from "./config/cors";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import messageRoutes from "./routes/message";
import websocketRoutes from "./routes/websocket";
import { isHttpError } from "./utils/http-error";
import { connectRedis } from "@pujo-map/redis";
import { serverWsMsgSchema } from "@pujo-map/types/ws";

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

fastify.setErrorHandler((error, request, reply) => {
  if (isHttpError(error)) {
    return reply.code(error.statusCode).send({
      code: error.code,
      message: error.message,
    });
  }

  request.log.error({ err: error }, "Unhandled server error");

  return reply.code(500).send({
    code: "INTERNAL",
    message: "Internal server error",
  });
});

fastify.setNotFoundHandler((request, reply) => {
  return reply.code(404).send({
    code: "NOT_FOUND",
    message: `Route ${request.method}:${request.url} not found`,
  });
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

// msg subscription handler
async function startRedisSubscription() {
  try {
    const client = await connectRedis();
    const sub = client.duplicate();

    await sub.connect();
    await sub.subscribe("events_toserver", (message) => {
      const event = serverWsMsgSchema.parse(JSON.parse(message));

      if (event.type === "msg_add" || event.type === "msg_delete") {
        fastify.broadcast(event);
      }
    });
  } catch (error) {
    fastify.log.error({ err: error }, "Failed to start Redis subscription");
  }
}

fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log("Server running on port 3000");
  void startRedisSubscription();
});
