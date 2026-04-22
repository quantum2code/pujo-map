import type { FastifyPluginAsync } from "fastify";
import {
  createMessage,
  deleteMessage,
  deleteMessageSchema,
  listMessages,
  messageSchema,
} from "../service/message";

const messageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/msg",
    { onRequest: fastify.authenticate },
    async (request, reply) => {
      const requestStartedAt = performance.now();
      const sessionStartedAt = performance.now();
      const session = await request.getSession();

      const sessionDurationMs = Number(
        (performance.now() - sessionStartedAt).toFixed(2),
      );

      if (!session) {
        fastify.log.info(
          {
            profile: "messages_request",
            method: request.method,
            url: request.url,
            sessionDurationMs,
            totalDurationMs: Number(
              (performance.now() - requestStartedAt).toFixed(2),
            ),
            statusCode: 401,
          },
          "Temporary request profiling",
        );

        return reply.status(401).send({ error: "Unauthorized" });
      }

      const queryStartedAt = performance.now();
      const messages = await listMessages(session.session.userId);
      const queryDurationMs = Number(
        (performance.now() - queryStartedAt).toFixed(2),
      );

      fastify.log.info(
        {
          profile: "messages_request",
          method: request.method,
          url: request.url,
          sessionDurationMs,
          queryDurationMs,
          messageCount: messages.length,
          totalDurationMs: Number(
            (performance.now() - requestStartedAt).toFixed(2),
          ),
          statusCode: 200,
        },
        "Temporary request profiling",
      );

      return messages;
    },
  );

  fastify.post(
    "/api/msg",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = messageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid message payload" });
      }

      const session = await request.getSession();
      if (!session) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const msg = await createMessage({
        text: parsed.data.text,
        userId: session.session.userId,
      });

      fastify.broadcast({
        type: "msg_add",
        data: msg,
      });

      return msg;
    },
  );

  fastify.delete(
    "/api/msg",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = deleteMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid delete payload" });
      }

      const session = await request.getSession();
      if (!session) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const msg = await deleteMessage({
        id: parsed.data.id,
        userId: session.session.userId,
      });

      if (!msg) {
        return reply.status(404).send({
          error: "message not found",
        });
      }

      fastify.broadcast({
        type: "msg_delete",
        data: msg,
      });

      return msg;
    },
  );
};

export default messageRoutes;
