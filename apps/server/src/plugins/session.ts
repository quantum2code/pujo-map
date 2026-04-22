import fp from "fastify-plugin";
import { auth } from "@pujo-map/auth";

export default fp(async (fastify) => {
  fastify.decorateRequest("_session", undefined);
  fastify.decorateRequest("getSession", async function () {
    if (this._session !== undefined) return this._session;

    const headers = new Headers();

    Object.entries(this.headers).forEach(([key, value]) => {
      if (value) {
        headers.append(key, value.toString());
      }
    });

    const startedAt = performance.now();

    this._session = await auth.api.getSession({
      headers,
    });

    fastify.log.info(
      {
        profile: "session_lookup",
        method: this.method,
        url: this.url,
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        hasSession: Boolean(this._session),
      },
      "Temporary request profiling",
    );

    return this._session;
  });
});
