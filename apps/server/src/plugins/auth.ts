import fp from "fastify-plugin";
import { auth } from "@pujo-map/auth";
import { HttpError } from "../utils/http-error";
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

  fastify.decorateRequest("requireSession", async function () {
    const session = await this.getSession();

    if (!session) {
      throw new HttpError(401, "UNAUTHORIZED", "Unauthorized");
    }

    return session;
  });

  fastify.decorate("authenticate", async (request) => {
    await request.requireSession();
  });
});
