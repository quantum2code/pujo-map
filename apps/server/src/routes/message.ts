import type { FastifyPluginAsync } from "fastify";
import { db } from "@pujo-map/db";
import { message } from "@pujo-map/db/schema/message";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { HttpError, isHttpError } from "../utils/http-error";

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
    async (request) => {
      const session = await request.requireSession();

      try {
        const messages = await db
          .select()
          .from(message)
          .where(eq(message.userId, session.session.userId));

        return messages;
      } catch (error) {
        if (isHttpError(error)) {
          throw error;
        }

        throw new HttpError(500, "INTERNAL", "Failed to load messages");
      }
    },
  );

  fastify.post(
    "/api/msg",
    { preHandler: fastify.authenticate },
    async (request) => {
      const parsed = createMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid message payload");
      }

      const session = await request.requireSession();

      try {
        const [created] = await db
          .insert(message)
          .values({
            text: parsed.data.text,
            userId: session.session.userId,
          })
          .returning();

        if (!created) {
          throw new HttpError(500, "INTERNAL", "Failed to create message");
        }

        fastify.broadcast({
          type: "msg_add",
          data: created,
        });

        return created;
      } catch (error) {
        if (isHttpError(error)) {
          throw error;
        }

        throw new HttpError(500, "INTERNAL", "Failed to create message");
      }
    },
  );

  fastify.delete(
    "/api/msg",
    { preHandler: fastify.authenticate },
    async (request) => {
      const parsed = deleteMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid delete payload");
      }

      const session = await request.requireSession();

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
          throw new HttpError(404, "NOT_FOUND", "Message not found");
        }

        fastify.broadcast({
          type: "msg_delete",
          data: deleted,
        });

        return deleted;
      } catch (error) {
        if (isHttpError(error)) {
          throw error;
        }

        throw new HttpError(500, "INTERNAL", "Failed to delete message");
      }
    },
  );
};

export default messageRoutes;
