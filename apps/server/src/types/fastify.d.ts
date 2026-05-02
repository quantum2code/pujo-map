import type { auth } from "@pujo-map/auth";
import "fastify";

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
type NonNullableAuthSession = NonNullable<AuthSession>;

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    broadcast: (data: unknown) => void;
    wsClients: Set<WebSocket>;
  }

  interface FastifyRequest {
    getSession: () => Promise<AuthSession>;
    requireSession: () => Promise<NonNullableAuthSession>;
    _session?: AuthSession | undefined;
  }
}
