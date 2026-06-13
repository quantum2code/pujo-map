import { createWorker } from "@pujo-map/redis/queue";
import { db } from "@pujo-map/db";
import { message } from "@pujo-map/db/schema/message";
import { eq } from "drizzle-orm";
import { serverWsMsgSchema, type ServerWsMsg } from "@pujo-map/types/ws";

type DbMessage = typeof message.$inferSelect;

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

const worker = createWorker(async (job): Promise<string> => {
  let event: ServerWsMsg;

  switch (job.name) {
    case "msg_delete": {
      const { messageId, userId } = job.data as {
        messageId: string;
        userId: string;
      };
      event = { type: "msg_delete", data: { id: messageId, userId } };
      break;
    }

    case "msg_add": {
      const { messageId } = job.data as { messageId: string };

      const [processingMessage] = await db
        .update(message)
        .set({ status: "processing" })
        .where(eq(message.id, messageId))
        .returning();

      if (!processingMessage) {
        throw new Error("DB status change to 'processing' failed");
      }

      const [processedMessage] = await db
        .update(message)
        .set({ status: "processed", text: processingMessage.text.toUpperCase() })
        .where(eq(message.id, messageId))
        .returning();

      if (!processedMessage) {
        throw new Error("DB status change to 'processed' failed");
      }

      event = { type: "msg_add", data: toMessageDto(processedMessage) };
      break;
    }

    case "calculate_route": {
      const { userId, start, destination } = job.data as {
        userId: string;
        start: { longitude: number; latitude: number };
        destination: { longitude: number; latitude: number };
      };

      try {
        const url = `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`OSRM responded with status: ${res.status}`);
        }
        const data = (await res.json()) as any;
        if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
          throw new Error(`OSRM routing failed: ${data.code || "No routes found"}`);
        }

        const bestRoute = data.routes[0];
        event = {
          type: "route_update",
          data: {
            userId,
            route: bestRoute.geometry,
            distance: bestRoute.distance,
            duration: bestRoute.duration,
          },
        };
      } catch (err: any) {
        console.error("[worker] calculate_route failed, returning fallback straight-line route:", err.message);
        event = {
          type: "route_update",
          data: {
            userId,
            route: {
              type: "LineString",
              coordinates: [
                [start.longitude, start.latitude],
                [destination.longitude, destination.latitude],
              ],
            },
            distance: 0,
            duration: 0,
          },
        };
      }
      break;
    }

    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }

  // Return value is picked up by QueueEvents 'completed' on the server
  return JSON.stringify(serverWsMsgSchema.parse(event));
});

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} (${job.name}) completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} (${job?.name}) failed:`, err.message);
});

console.log("[worker] started");
