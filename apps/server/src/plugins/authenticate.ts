import fp from "fastify-plugin";

export default fp(async (fastify) => {
  fastify.decorate("authenticate", async (request, reply) => {
    const session = await request.getSession();
    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
});
