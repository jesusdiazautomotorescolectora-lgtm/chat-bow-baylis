import { useEffect, useMemo, useState } from "react";
import { api, CORE_API_URL, TENANT_ID } from "./api";
import type { Conversation, Message } from "./types";
import { io } from "socket.io-client";
import "./styles.css";

export default function App() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");

  const active = useMemo(() => convos.find(c => c.id === activeId) || null, [convos, activeId]);

  async function loadInbox() {
    const { data } = await api.get<Conversation[]>("/api/inbox?status=open");
    setConvos(data);
    if (!activeId && data[0]?.id) setActiveId(data[0].id);
  }

  async function loadMessages(convoId: string) {
    const { data } = await api.get<Message[]>(`/api/conversations/${convoId}/messages`);
    setMessages(data);
  }

  useEffect(() => {
    loadInbox().catch(console.error);
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId).catch(console.error);
  }, [activeId]);

  useEffect(() => {
    const s = io(CORE_API_URL, { query: { tenantId: TENANT_ID } });
    s.on("conversation_updated", () => loadInbox().catch(console.error));
    s.on("message_created", (evt: any) => {
      if (evt?.conversationId && evt.conversationId === activeId) {
        loadMessages(activeId).catch(console.error);
      } else {
        loadInbox().catch(console.error);
      }
    });
    return () => { s.close(); };
  }, [activeId]);

  async function send() {
    if (!active) return;
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await api.post(`/api/conversations/${active.id}/reply`, { text });
    await loadMessages(active.id);
  }

  async function takeover() {
    if (!active) return;
    await api.post(`/api/conversations/${active.id}/takeover`, {});
    await loadInbox();
  }

  async function returnToBot() {
    if (!active) return;
    await api.post(`/api/conversations/${active.id}/return-to-bot`, {});
    await loadInbox();
  }

  return (
    <div className="container">
      <div className="sidebar">
        <div className="header">
          <div style={{ fontWeight: 700 }}>Omni Hub</div>
          <span className="badge">{TENANT_ID.slice(0, 8)}</span>
        </div>

        {convos.map(c => (
          <div
            key={c.id}
            className={"listItem " + (c.id === activeId ? "active" : "")}
            onClick={() => setActiveId(c.id)}
          >
            <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
              <div style={{ fontWeight: 650 }}>{c.externalThreadId}</div>
              <span className="badge">{c.channel}</span>
            </div>
            <div className="small">Modo: {c.mode} · Status: {c.status}</div>
          </div>
        ))}
      </div>

      <div className="main">
        <div className="header">
          <div style={{ fontWeight: 700 }}>{active ? active.externalThreadId : "Seleccioná una conversación"}</div>
          {active && <span className="badge">{active.channel}</span>}
          {active && <span className="badge">Modo: {active.mode}</span>}
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            <button onClick={takeover} disabled={!active || active.mode === "HUMAN"}>Takeover (HUMAN)</button>
            <button onClick={returnToBot} disabled={!active || active.mode === "BOT_ON"}>Return to BOT</button>
          </div>
        </div>

        <div className="messages">
          {messages.map(m => (
            <div key={m.id} className={"msg " + (m.fromMe ? "me" : "")}>
              <div className="small">{new Date(m.createdAt).toLocaleString()}</div>
              {m.type === "image" && m.mediaUrl ? (
                <div style={{ marginTop: 8 }}>
                  <img src={m.mediaUrl} style={{ maxWidth: "100%", borderRadius: 10 }} />
                </div>
              ) : null}
              {m.text ? <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{m.text}</div> : null}
            </div>
          ))}
        </div>

        <div className="composer">
          <textarea
            placeholder="Escribí una respuesta..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void send();
            }}
          />
          <button onClick={send} disabled={!active}>Enviar</button>
        </div>
      </div>
    </div>
  );
}
