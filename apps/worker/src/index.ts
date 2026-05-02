import { connectRedis } from "@pujo-map/redis";
import { GROUP, initRedisStream, STREAM } from "@pujo-map/redis/stream";
import { db } from "@pujo-map/db";
import { message } from "@pujo-map/db/schema/message";
import { eq } from "drizzle-orm";
import { queueJobSchema, type QueueJob } from "@pujo-map/types/job";
import { serverWsMsgSchema, type ServerWsMsg } from "@pujo-map/types/ws";

await initRedisStream();

const EVENTS_TO_SERVER_CHANNEL = "events_toserver";

type DbMessage = typeof message.$inferSelect;
type StreamMessage = { id: string; message: Record<string, string> };
type StreamReadResult = Array<{ name: string; messages: StreamMessage[] }>;

function toMessageDto(dbMessage: DbMessage) {
  return {
    id: dbMessage.id,
    text: dbMessage.text,
    userId: dbMessage.userId,
    status: dbMessage.status,
    createdAt:
      dbMessage.createdAt instanceof Date
        ? dbMessage.createdAt.toISOString()
        : String(dbMessage.createdAt),
  };
}

function parseQueuedJob(fields: Record<string, string>) {
  const rawType = fields.type;
  const rawData = fields.data;

  if (!rawType || !rawData) {
    throw new Error("Queued job is missing type or data field");
  }

  //extra safe vaildation
  const parsedJob = queueJobSchema.safeParse({
    type: rawType,
    data: JSON.parse(rawData),
  });

  if (!parsedJob.success) {
    throw parsedJob.error;
  }

  return parsedJob.data;
}

function isStreamReadResult(value: unknown): value is StreamReadResult {
  return Array.isArray(value);
}

async function publishServerEvent(
  pub: Awaited<ReturnType<typeof connectRedis>>,
  event: ServerWsMsg,
) {
  const parsed = serverWsMsgSchema.parse(event);

  await pub.publish(EVENTS_TO_SERVER_CHANNEL, JSON.stringify(parsed));
}

async function processJob(pub: Awaited<ReturnType<typeof connectRedis>>, job: QueueJob) {
  switch (job.type) {
    case ("msg_delete"):
      await publishServerEvent(pub, {
        type: "msg_delete",
        data: { id: job.data.messageId, userId: job.data.userId },
      });
      break;
    case ("msg_add"):
      const [processingMessage] = await db
        .update(message)
        .set({ status: "processing" })
        .where(eq(message.id, job.data.messageId))
        .returning();

      if (!processingMessage) {
        throw new Error("db row status change failed");
      }

      const [processedMessage] = await db
        .update(message)
        .set({ status: "processed", text: processingMessage.text.toUpperCase() })
        .where(eq(message.id, job.data.messageId))
        .returning();

      if (!processedMessage) {
        throw new Error("db row processing completion failed");
      }

      await publishServerEvent(pub, {
        type: "msg_add",
        data: toMessageDto(processedMessage),
      });
      break;
  default: return
  }
}

export async function startWorker(consumerName: string) {
  const client = await connectRedis();
  const pub = client.duplicate();

  await pub.connect();

  while (true) {
    const res = await client.xReadGroup(
      GROUP,
      consumerName,
      { key: STREAM, id: ">" },
      { BLOCK: 5000, COUNT: 1 },
    );
    if (!res) continue;
    if (!isStreamReadResult(res)) continue;

    for (const stream of res) {
      for (const msg of stream.messages) {
        const queuedJob = parseQueuedJob(msg.message);

        await processJob(pub, queuedJob);
        console.log("Processed job:", queuedJob);

        await client.xAck(STREAM, GROUP, msg.id);
      }
    }
  }
}

await startWorker(`worker-${process.pid}`);
