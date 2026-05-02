import { connectRedis } from "@pujo-map/redis";
import { STREAM } from "@pujo-map/redis/stream";
import { queueJobSchema, type QueueJob } from "@pujo-map/types/job";

export async function addJob(job: QueueJob) {
  const parsed = queueJobSchema.parse(job);
  const client = await connectRedis();

  await client.xAdd(STREAM, "*", {
    type: parsed.type,
    data: JSON.stringify(parsed.data),
  });
}
