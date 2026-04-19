import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { getServerUrl, getWebSocketUrl } from "@/lib/server-url";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    return { session };
  },
});

function RouteComponent() {
  const [value, setValue] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const { session } = Route.useRouteContext();

  useEffect(() => {
    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("connected");
      ws.send(JSON.stringify({ type: "open" }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("server: ", msg);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = String(formData.get("message") ?? "").trim();
    if (!text) return;
    fetch(`${getServerUrl()}api/msg`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: text }),
    });
  };

  return (
    <div className="mx-auto flex flex-col items-center justify-center h-screen">
      <section>
        <h1>Dashboard</h1>
        <p>Welcome {session.data?.user.name}</p>
      </section>
      <section></section>
      <div className="py-10">
        <form onSubmit={handleSubmit}>
          <label>
            submit event
            <input
              type="text"
              name="message"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="outline mx-4"
            />
          </label>
          <button type="submit">submit</button>
        </form>
        <button
          onClick={() => {
            wsRef.current?.send(
              JSON.stringify({ type: "greet", data: "hello" }),
            );
          }}
        >
          send test
        </button>
      </div>
    </div>
  );
}
