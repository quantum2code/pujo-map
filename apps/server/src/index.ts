import fastifyCors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { baseCorsConfig } from "./config/cors";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import messageRoutes from "./routes/message";
import websocketRoutes from "./routes/websocket";
import routingRoutes from "./routes/routing";
import { isHttpError } from "./utils/http-error";
import { env } from "@pujo-map/env/server";
import { createQueueEvents } from "@pujo-map/redis/queue";
import { serverWsMsgSchema } from "@pujo-map/types/ws";

const fastify = Fastify({
  logger: true,
});


fastify.decorate("wsClients", new Map<string, Set<any>>());
fastify.decorate("broadcast", (data: unknown) => {
  const msg = JSON.stringify(data);
  for (const sockets of fastify.wsClients.values()) {
    for (const client of sockets) {
      client.send(msg);
    }
  }
});
fastify.decorate("sendToUser", (userId: string, data: unknown) => {
  const msg = JSON.stringify(data);
  const sockets = fastify.wsClients.get(userId);
  if (sockets) {
    for (const socket of sockets) {
      socket.send(msg);
    }
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
fastify.register(routingRoutes);

fastify.get("/", async () => {
  return "OK";
});

// job completion → WS broadcast
function startQueueEvents() {
  const queueEvents = createQueueEvents();

  queueEvents.on("completed", ({ returnvalue }) => {
    try {
      const event = serverWsMsgSchema.parse(JSON.parse(returnvalue));
      if (event.type === "msg_add" || event.type === "msg_delete") {
        fastify.broadcast(event);
      } else if (event.type === "route_update") {
        fastify.sendToUser(event.data.userId, event);
      }
    } catch (err) {
      fastify.log.error({ err }, "Failed to parse completed job event");
    }
  });

  queueEvents.on("failed", ({ jobId, failedReason }) => {
    fastify.log.error({ jobId, failedReason }, "Job failed");
  });
}

fastify.listen({ port: env.PORT }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Server running on port ${env.PORT}`);
  startQueueEvents();
});
