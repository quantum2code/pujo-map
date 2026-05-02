
import { connectRedis } from '@pujo-map/redis';
import { STREAM } from '@pujo-map/redis/stream';

export async function addJob(data: Record<string, string>) {
  const client = await connectRedis();

  await client.xAdd(STREAM, '*', data);
}
