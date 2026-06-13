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

function decodePolyline(str: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  const len = str.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push([lng * 1e-5, lat * 1e-5]);
  }

  return coordinates;
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
        const graphqlQuery = {
          query: `
            query {
              plan(
                from: { lat: ${start.latitude}, lon: ${start.longitude} }
                to: { lat: ${destination.latitude}, lon: ${destination.longitude} }
                numItineraries: 1
              ) {
                itineraries {
                  duration
                  walkDistance
                  legs {
                    mode
                    distance
                    duration
                    legGeometry {
                      points
                    }
                  }
                }
              }
            }
          `,
        };

        const res = await fetch("http://localhost:8080/otp/routers/default/index/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(graphqlQuery),
        });

        if (!res.ok) {
          throw new Error(`OTP server responded with status: ${res.status}`);
        }

        const body = (await res.json()) as any;
        if (body.errors && body.errors.length > 0) {
          throw new Error(body.errors[0].message || "GraphQL Error from OTP server");
        }

        const plan = body.data?.plan;
        if (!plan || !plan.itineraries || plan.itineraries.length === 0) {
          throw new Error("No route found between coordinates");
        }

        const itinerary = plan.itineraries[0];
        const coordinates: [number, number][] = [];
        let totalDistance = 0;
        let totalDuration = 0;

        for (const leg of itinerary.legs) {
          totalDistance += leg.distance || 0;
          totalDuration += leg.duration || 0;
          if (leg.legGeometry?.points) {
            const legCoords = decodePolyline(leg.legGeometry.points);
            coordinates.push(...legCoords);
          }
        }

        event = {
          type: "route_update",
          data: {
            userId,
            route: {
              type: "LineString",
              coordinates,
            },
            distance: totalDistance,
            duration: totalDuration,
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
