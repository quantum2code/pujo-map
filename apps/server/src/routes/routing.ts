import type { FastifyPluginAsync } from "fastify";
import z from "zod";
import { HttpError } from "../utils/http-error";

// Polyline decoder implementation (Google polyline algorithm)
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

const querySchema = z.object({
  startLng: z.coerce.number(),
  startLat: z.coerce.number(),
  destLng: z.coerce.number(),
  destLat: z.coerce.number(),
  mode: z.string().optional().default("WALK"),
});

const routingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/route",
    { preHandler: fastify.authenticate },
    async (request) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid coordinates or query parameters");
      }

      const { startLng, startLat, destLng, destLat } = parsed.data;

      const graphqlQuery = {
        query: `
          query {
            plan(
              from: { lat: ${startLat}, lon: ${startLng} }
              to: { lat: ${destLat}, lon: ${destLng} }
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

      try {
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
          throw new HttpError(404, "ROUTE_NOT_FOUND", "No route found between coordinates");
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

        return {
          route: {
            type: "LineString",
            coordinates,
          },
          distance: totalDistance,
          duration: totalDuration,
        };
      } catch (err: any) {
        if (err instanceof HttpError) throw err;
        request.log.error(err);
        throw new HttpError(500, "ROUTING_FAILED", err.message || "Failed to contact OTP2 routing engine");
      }
    }
  );
};

export default routingRoutes;
