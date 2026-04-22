import fp from "fastify-plugin";
import { auth } from "@pujo-map/auth";
import { toWebHeaders } from "../utils/web-request";

export default fp(async (fastify) => {
  fastify.decorateRequest("_session", undefined);
  fastify.decorateRequest("getSession", async function () {
    if (this._session !== undefined) return this._session;

    this._session = await auth.api.getSession({
      headers: toWebHeaders(this.headers),
    });

    return this._session;
  });

  fastify.decorateRequest("requireSession", async function (reply) {
    const session = await this.getSession();

    if (!session) {
      reply.code(401).send({
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      });
      return null;
    }

    return session;
  });

  fastify.decorate("authenticate", async (request, reply) => {
    await request.requireSession(reply);
  });
});
