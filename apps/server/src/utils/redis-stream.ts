import { createQueue } from "@pujo-map/redis/queue";
import { queueJobSchema, type QueueJob } from "@pujo-map/types/job";

const queue = createQueue();

export async function addJob(job: QueueJob): Promise<void> {
  const parsed = queueJobSchema.parse(job);
  await queue.add(parsed.type, parsed.data);
}
