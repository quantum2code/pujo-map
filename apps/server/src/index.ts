import fastifyCors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { auth } from "@pujo-map/auth";
import { allowedOrigins, env } from "@pujo-map/env/server";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

const baseCorsConfig = {
  origin(
    origin: string | undefined,
    callback: (error: Error | null, allow: boolean) => void,
  ) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (env.NODE_ENV === "development") {
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

const fastify = Fastify({
  logger: true,
});

fastify.register(fastifyCors, baseCorsConfig);
await fastify.register(websocket);

fastify.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    } catch (error) {
      fastify.log.error({ err: error }, "Authentication Error:");
      reply.status(500).send({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    }
  },
});
fastify.decorate(
  "authenticate",
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();

      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
      });
      const session = await auth.api.getSession(req);

      if (!session) {
        reply.status(401).send({
          error: "Not authenticated",
          code: "AUTH_FAILURE",
        });
        return;
      }

      (request as FastifyRequest & { user?: typeof session.user }).user =
        session.user;
    } catch (error) {
      reply.status(401).send({
        error: "Not authenticated",
        code: "AUTH_FAILURE",
      });
    }
  },
);

fastify.get(
  "/ws",
  { websocket: true, preHandler: fastify.authenticate },
  async (socket, req) => {
    socket.on("message", (message) => {
      console.log("client: ", message.toString());
      socket.send("hi from wss");
    });
  },
);

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
