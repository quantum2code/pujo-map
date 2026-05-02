import z from "zod";

export const queueJobSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("msg_add"),
    data: z.object({ messageId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal("msg_delete"),
    data: z.object({ messageId: z.string().min(1), userId: z.string().min(1) }),
  }),
]);

export type QueueJob = z.infer<typeof queueJobSchema>;
