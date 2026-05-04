import { HttpError, isHttpError } from "@/utils/http-error";
import { db } from "@pujo-map/db";
import { place } from "@pujo-map/db/schema/index";
import { isNotNull, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";

export const placeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/place",
    { preHandler: fastify.authenticate },
    async (request) => {
      await request.requireSession();

      try {
        const places = await db
          .select({
            id: place.id,
            name: place.name,
            amenity: place.amenity,
            latitude: sql<number>`ST_Y(${place.location})`.as("latitude"),
            longitude: sql<number>`ST_X(${place.location})`.as("longitude"),
          })
          .from(place)
          .where(isNotNull(place.location));
        return places;
      } catch (error) {
        if (isHttpError(error)) {
          throw error;
        }
        throw new HttpError(500, "INTERNAL", "Failed to load places");
      }
    },
  );
};
