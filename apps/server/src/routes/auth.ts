import { auth } from "@pujo-map/auth";
import type { FastifyPluginAsync } from "fastify";
import { HttpError } from "../utils/http-error";
import { toWebRequest } from "../utils/web-request";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const response = await auth.handler(toWebRequest(request));
        reply.status(response.status);
        response.headers.forEach((value, key) => reply.header(key, value));
        reply.send(response.body ? await response.text() : null);
      } catch (error) {
        fastify.log.error({ err: error }, "Authentication Error:");
        throw new HttpError(500, "AUTH_FAILURE", "Internal authentication error");
      }
    },
  });
};

export default authRoutes;
