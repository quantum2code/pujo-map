import type { FastifyPluginAsync } from "fastify";

const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/ws",
    { websocket: true, preHandler: fastify.authenticate },
    async (socket) => {
      fastify.wsClients.add(socket);

      socket.on("message", (message: Buffer) => {
        const msg = JSON.parse(message.toString());
        socket.send(
          JSON.stringify({
            type: "reply",
            data: `recived: ${JSON.stringify(msg)}`,
          }),
        );
      });

      socket.on("close", () => {
        fastify.wsClients.delete(socket);
      });
    },
  );
};

export default websocketRoutes;
