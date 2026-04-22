import z from "zod";

export const wsMsgAddSchema = z.object({
  id: z.string(),
  text: z.string(),
  userId: z.string(),
  createdAt: z.string(),
});
export const wsMsgDelSchema = z.object({ id: z.string(), userId: z.string() });
export const wsErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const serverWsMsgSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("msg_add"), data: wsMsgAddSchema }),
  z.object({ type: z.literal("msg_delete"), data: wsMsgDelSchema }),
  //   z.object({ type: z.literal("error") }).extend(wsErrorSchema.shape), ditched for keeping consistent use of data field
  z.object({ type: z.literal("error"), data: wsErrorSchema }),
  z.object({ type: z.literal("pong") }),
]);

export const clientWsMsgSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("greet"), data: z.string() }),
  z.object({ type: z.literal("ping") }),
]);
