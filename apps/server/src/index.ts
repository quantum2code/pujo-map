import fastifyCors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { auth } from "@pujo-map/auth";
import { db } from "@pujo-map/db";
import { message } from "@pujo-map/db/schema/message";
import { allowedOrigins, env } from "@pujo-map/env/server";
import { and, eq } from "drizzle-orm";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import z, { string } from "zod";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user?: {
      id: string;
    };
  }
}

const msgSchema = z.object({
  text: string(),
});
const clients: Set<WebSocket> = new Set();

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

function broadcast(data: any) {
  const msg = JSON.stringify(data);

  for (const client of clients) {
    client.send(msg);
  }
}

fastify.get(
  "/api/msg",
  { preHandler: fastify.authenticate },
  async (request, reply) => {
    if (!request.user) {
      reply.status(401).send({
        error: "Not authenticated",
        code: "AUTH_FAILURE",
      });
      return;
    }
    const userId = request.user?.id;
    if (!userId) {
      reply.status(401).send({
        error: "Not authenticated",
        code: "AUTH_FAILURE",
      });
      return;
    }

    const msgs = await db
      .select()
      .from(message)
      .where(eq(message.userId, userId));
    if (!msgs) {
      reply.status(500).send({
        error: "Server failed",
        code: "SERVER_FAILURE",
      });
      return;
    }
    return msgs;
  },
);

fastify.post(
  "/api/msg",
  { preHandler: fastify.authenticate },
  async (request, reply) => {
    const { data, error } = msgSchema.safeParse(request.body);
    if (error)
      reply.status(500).send({
        error: error.message,
      });
    const msg = await db
      .insert(message)
      .values({
        text: data?.text || "",
        userId: request.user!.id,
      })
      .returning();
    broadcast({
      type: "msg_add",
      data: msg[0],
    });
    return msg[0];
  },
);

fastify.delete(
  "/api/msg",
  { preHandler: fastify.authenticate },
  async (request, reply) => {
    const deleteSchema = z.object({
      id: string().min(1),
    });

    const { data, error } = deleteSchema.safeParse(request.body);
    if (error) {
      return reply.status(400).send({
        error: "invalid id",
      });
    }

    const msg = await db
      .delete(message)
      .where(and(eq(message.id, data.id), eq(message.userId, request.user!.id)))
      .returning();

    if (!msg[0]) {
      return reply.status(404).send({
        error: "message not found",
      });
    }
    broadcast({
      type: "msg_delete",
      data: msg[0],
    });
    return msg[0];
  },
);

fastify.get(
  "/ws",
  { websocket: true, preHandler: fastify.authenticate },
  async (socket) => {
    clients.add(socket);
    socket.on("message", (message: any) => {
      const msg = JSON.parse(message.toString());
      socket.send(
        JSON.stringify({
          type: "reply",
          data: `recived: ${JSON.stringify(msg)}`,
        }),
      );
    });
    socket.on("close", () => {
      clients.delete(socket);
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
