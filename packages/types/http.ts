import z from "zod";

export const createMessageBodySchema = z.object({
  text: z.string().trim().min(1),
});

export const deleteMessageBodySchema = z.object({
  id: z.string().min(1),
});

export type CreateMessageBody = z.infer<typeof createMessageBodySchema>;
export type DeleteMessageBody = z.infer<typeof deleteMessageBodySchema>;
