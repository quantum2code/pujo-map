import { Queue, QueueEvents, Worker, type Processor } from "bullmq";

export const QUEUE_NAME = "jobs";

function getConnection() {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

/** Used by the server to enqueue jobs. */
export function createQueue() {
  return new Queue(QUEUE_NAME, { connection: getConnection() });
}

/** Used by the server to listen for completed / failed job events. */
export function createQueueEvents() {
  return new QueueEvents(QUEUE_NAME, { connection: getConnection() });
}

/** Used by the worker process to consume and process jobs. */
export function createWorker(processor: Processor, concurrency = 5) {
  return new Worker(QUEUE_NAME, processor, {
    connection: getConnection(),
    concurrency,
  });
}
