// EventSource hook template for Next.js / React.
//
// Copy and adapt to your event types.
// Key patterns: chunk concatenation, proper cleanup, status tracking.

"use client";

import { useEffect, useRef, useState } from "react";

interface StreamEvent {
  id: number;
  type: string;
  content: string;
  tool?: string;
  timestamp: Date;
}

interface UseEventStreamOptions {
  url: string;
  /** Called when "done" event is received */
  onComplete?: () => void;
}

export function useEventStream({ url, onComplete }: UseEventStreamOptions) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<
    "connecting" | "running" | "done" | "error"
  >("connecting");
  const nextId = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    const es = new EventSource(url);
    let receivedAny = false;

    // ---- Core: add event with chunk concatenation ----
    const addEvent = (
      type: string,
      content: string,
      tool?: string
    ) => {
      if (!receivedAny) {
        receivedAny = true;
        setStatus("running");
      }

      // KEY PATTERN: Merge consecutive same-type events.
      // Without this, streaming text like "我来开始分析" appears as
      // separate lines: "我", "来", "开", "始", "分", "析".
      if (type === "thinking" || type === "message") {
        setEvents((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === type) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + content,
            };
            return updated;
          }
          return [
            ...prev,
            { id: nextId.current++, type, content, tool, timestamp: new Date() },
          ];
        });
        return;
      }

      setEvents((prev) => [
        ...prev,
        { id: nextId.current++, type, content, tool, timestamp: new Date() },
      ]);
    };

    // ---- Register event listeners ----
    // Adapt these to your SSE event types.

    es.addEventListener("agent_thinking", (e) => {
      addEvent("thinking", JSON.parse(e.data).content);
    });

    es.addEventListener("tool_call", (e) => {
      const data = JSON.parse(e.data);
      const input =
        typeof data.input === "string"
          ? data.input
          : JSON.stringify(data.input, null, 2);
      addEvent("tool_call", input, data.tool);
    });

    es.addEventListener("tool_result", (e) => {
      addEvent("tool_result", JSON.parse(e.data).output);
    });

    es.addEventListener("agent_message", (e) => {
      addEvent("message", JSON.parse(e.data).content);
    });

    es.addEventListener("artifact", (e) => {
      addEvent("artifact", JSON.parse(e.data).path);
    });

    es.addEventListener("agent_error", (e) => {
      const me = e as MessageEvent;
      addEvent("error", JSON.parse(me.data).message || "Unknown error");
      setStatus("error");
    });

    es.addEventListener("done", () => {
      doneRef.current = true;
      setStatus("done");
      es.close();
      onComplete?.();
    });

    // ---- Error handling ----
    // KEY PATTERN: Don't infinite-reconnect after done.
    es.onerror = () => {
      if (doneRef.current) {
        es.close();
        return;
      }
      // Server closed connection for completed resource — treat as done.
      if (receivedAny) {
        setStatus("done");
        es.close();
        return;
      }
      // Otherwise: connection issue. EventSource auto-retries.
    };

    return () => es.close();
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, status };
}
