import type { FastifyPluginAsync } from "fastify";
import { db } from "@pujo-map/db";
import { message } from "@pujo-map/db/schema/message";
import { and, eq } from "drizzle-orm";
import z from "zod";

const createMessageSchema = z.object({
  text: z.string(),
});

const deleteMessageSchema = z.object({
  id: z.string().min(1),
});

const messageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/msg",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const session = await request.requireSession(reply);
      if (!session) return;

      try {
        const messages = await db
          .select()
          .from(message)
          .where(eq(message.userId, session.session.userId));

        return reply.send(messages);
      } catch {
        return reply.code(500).send({
          code: "INTERNAL",
          message: "Failed to load messages",
        });
      }
    },
  );

  fastify.post(
    "/api/msg",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = createMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
          message: "Invalid message payload",
        });
      }

      const session = await request.requireSession(reply);
      if (!session) return;

      try {
        const [created] = await db
          .insert(message)
          .values({
            text: parsed.data.text,
            userId: session.session.userId,
          })
          .returning();

        if (!created) {
          return reply.code(500).send({
            code: "INTERNAL",
            message: "Failed to create message",
          });
        }

        fastify.broadcast({
          type: "msg_add",
          data: created,
        });

        return reply.send(created);
      } catch {
        return reply.code(500).send({
          code: "INTERNAL",
          message: "Failed to create message",
        });
      }
    },
  );

  fastify.delete(
    "/api/msg",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = deleteMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
          message: "Invalid delete payload",
        });
      }

      const session = await request.requireSession(reply);
      if (!session) return;

      try {
        const [deleted] = await db
          .delete(message)
          .where(
            and(
              eq(message.id, parsed.data.id),
              eq(message.userId, session.session.userId),
            ),
          )
          .returning({ id: message.id, userId: message.userId });

        if (!deleted) {
          return reply.code(404).send({
            code: "NOT_FOUND",
            message: "Message not found",
          });
        }

        fastify.broadcast({
          type: "msg_delete",
          data: deleted,
        });

        return reply.send(deleted);
      } catch {
        return reply.code(500).send({
          code: "INTERNAL",
          message: "Failed to delete message",
        });
      }
    },
  );
};

export default messageRoutes;
