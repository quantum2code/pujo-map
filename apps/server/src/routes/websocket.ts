import type { FastifyPluginAsync } from "fastify";
import { clientWsMsgSchema } from "@pujo-map/types/ws";
import { addJob } from "@/utils/redis-stream";

const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/ws",
    { websocket: true, preHandler: fastify.authenticate },
    async (socket, request) => {
      const session = await request.requireSession();
      const userId = session.session.userId;

      // Add to user's socket pool
      if (!fastify.wsClients.has(userId)) {
        fastify.wsClients.set(userId, new Set());
      }
      fastify.wsClients.get(userId)!.add(socket);

      socket.on("message", async (message: Buffer) => {
        try {
          const raw = JSON.parse(message.toString());
          const parsed = clientWsMsgSchema.safeParse(raw);
          
          if (!parsed.success) {
            socket.send(
              JSON.stringify({
                type: "error",
                data: {
                  code: "INVALID_FORMAT",
                  message: "Invalid WebSocket message format",
                },
              })
            );
            return;
          }

          const msg = parsed.data;

          if (msg.type === "ping") {
            socket.send(JSON.stringify({ type: "pong" }));
          } else if (msg.type === "location_update") {
            const { longitude, latitude, destination } = msg.data;
            if (destination) {
              await addJob({
                type: "calculate_route",
                data: {
                  userId,
                  start: { longitude, latitude },
                  destination,
                },
              });
            }
          }
        } catch (err: any) {
          socket.send(
            JSON.stringify({
              type: "error",
              data: {
                code: "SERVER_ERROR",
                message: err.message || "An error occurred",
              },
            })
          );
        }
      });

      socket.on("close", () => {
        const sockets = fastify.wsClients.get(userId);
        if (sockets) {
          sockets.delete(socket);
          if (sockets.size === 0) {
            fastify.wsClients.delete(userId);
          }
        }
      });
    },
  );
};

export default websocketRoutes;
