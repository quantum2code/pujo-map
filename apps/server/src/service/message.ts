import { db } from "@pujo-map/db";
import { message } from "@pujo-map/db/schema/message";
import { and, eq } from "drizzle-orm";
import z from "zod";

export const messageSchema = z.object({
  text: z.string(),
});

export const deleteMessageSchema = z.object({
  id: z.string().min(1),
});

export async function listMessages(userId: string) {
  return db.select().from(message).where(eq(message.userId, userId));
}

export async function createMessage(input: {
  text: string;
  userId: string;
}) {
  const [created] = await db
    .insert(message)
    .values({
      text: input.text,
      userId: input.userId,
    })
    .returning();

  return created;
}

export async function deleteMessage(input: { id: string; userId: string }) {
  const [deleted] = await db
    .delete(message)
    .where(and(eq(message.id, input.id), eq(message.userId, input.userId)))
    .returning({ id: message.id, userId: message.userId });

  return deleted ?? null;
}
