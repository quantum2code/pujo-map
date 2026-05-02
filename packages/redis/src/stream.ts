import { connectRedis } from ".";

export const STREAM = "jobs";
export const GROUP = "workers";

function isBusyGroupError(error: unknown) {
  return error instanceof Error && error.message.includes("BUSYGROUP");
}

export async function initRedisStream() {
  const client = await connectRedis();

  try {
    await client.xGroupCreate(STREAM, GROUP, "0", {
      MKSTREAM: true,
    });
  } catch (err) {
    if (!isBusyGroupError(err)) {
      throw err;
    }
  }
}
