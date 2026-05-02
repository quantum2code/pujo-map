import { connectRedis } from "@pujo-map/redis";
import {GROUP, initRedisStream, STREAM} from "@pujo-map/redis/stream"

await initRedisStream();

export async function startWorker(consumerName: string) {
  //get the connected client
  const client = await connectRedis();

  //read the stream loop

  while (true) {
    const res = await client.xReadGroup(
      GROUP,
      consumerName,
      { key: STREAM, id: '>' },
      { BLOCK: 5000, COUNT: 1 }
    );
    if (!res) continue

    //execute
    for (const stream of res) {
      for (const msg of stream.messages) {
        console.log('Processing:', msg.message);

        await client.xAck(STREAM, GROUP, msg.id);
      }
    }
  }


}


await startWorker(`worker-${process.pid}`);
