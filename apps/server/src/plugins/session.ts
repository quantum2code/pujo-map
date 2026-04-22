import fp from "fastify-plugin";
import { auth } from "@pujo-map/auth";

export default fp(async (fastify) => {
  fastify.decorateRequest("_session", undefined);
  fastify.decorateRequest("getSession", async function () {
    if (this._session !== undefined) return this._session;

    // const headers = new Headers();

    // Object.entries(this.headers).forEach(([key, value]) => {
    //   if (value) {
    //     headers.append(key, value.toString());
    //   }
    // });

    this._session = await auth.api.getSession({
      headers: this.headers as Headers,
    });

    return this._session;
  });
});
