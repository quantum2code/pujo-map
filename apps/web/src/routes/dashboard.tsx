import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { getServerUrl, getWebSocketUrl } from "@/lib/server-url";
import { useEffect, useRef, useState } from "react";

export type Message = {
  id: string;
  text: string;
  userId: string;
  createdAt: string;
  status: "queued" | "processing" | "processed" | "failed";
};

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

export const getMsgs = async () => {
  const res = await fetch(`${getServerUrl()}api/msg`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to load messages");
  }

  return res.json();
};

function RouteComponent() {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const { session } = Route.useRouteContext();

  useEffect(() => {
    let mounted = true;

    const loadMessages = async () => {
      const data = await getMsgs();
      if (mounted) setMessages(data);
    };

    loadMessages();

    return () => {
      mounted = false;
    };
  }, []);

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

      if (msg.type === "msg_add") {
        setMessages((prev) => [...prev, msg.data]);
      } else if (msg.type === "msg_delete") {
        setMessages((prev) => prev.filter((m) => m.id !== msg.data.id));
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = String(formData.get("message") ?? "").trim();
    if (!text) return;
    await fetch(`${getServerUrl()}api/msg`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: text }),
    });
  };

  const deleteHandler = async (id: string) => {
    await fetch(`${getServerUrl()}api/msg`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: id }),
    });
  };

  return (
    <div className="mx-auto flex flex-col items-center justify-center h-screen">
      <section>
        <h1>Dashboard</h1>
        <p>Welcome {session.data?.user.name}</p>
      </section>
      <section>
        <div className="outline p-2  bg-linear-to-b from-neutral-900 px-3 mt-4">
          {messages.map((m) => (
            <p key={m.id}>
              {m.text}{" "}
              {m.userId === session.data?.user.id && (
                <button
                  className="m-2 border px-2"
                  onClick={async () => await deleteHandler(m.id)}
                >
                  X
                </button>
              )}
            </p>
          ))}
        </div>
      </section>
      <div className="py-10 text-center">
        <form onSubmit={handleSubmit} className="outline p-4">
          <label>
            submit event
            <input
              type="text"
              name="message"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="outline mx-4 p-1"
            />
          </label>
          <button className="border bg-neutral-600 px-3" type="submit">
            submit
          </button>
        </form>
        <button
          className="border bg-neutral-600 px-3 mt-3"
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
