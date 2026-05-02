import z from "zod";

export const messageStatusSchema = z.enum([
  "queued",
  "processing",
  "processed",
  "failed",
]);

export type MessageStatus = z.infer<typeof messageStatusSchema>;

export const messageDtoSchema = z.object({
  id: z.string(),
  text: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  status: messageStatusSchema,
});

export type MessageDto = z.infer<typeof messageDtoSchema>;
