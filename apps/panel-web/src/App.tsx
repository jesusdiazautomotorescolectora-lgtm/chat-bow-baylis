import React, { useEffect, useMemo, useState } from "react";

type InboxItem = {
  id: string;
  remote_jid: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message: null | { text?: string | null; direction: string; image_url?: string | null; created_at: string };
};

type Msg = {
  id: string;
  direction: "inbound" | "outbound";
  text: string | null;
  image_url: string | null;
  created_at: string;
};

function lsGet(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

export default function App() {
  const [apiBase, setApiBase] = useState(lsGet("apiBase", "http://localhost:3000"));
  const [token, setToken] = useState(lsGet("x-panel-token", "admin_123456"));
  const [tenantId, setTenantId] = useState(lsGet("x-tenant-id", "11b69e24-513a-4b18-86d3-d50a0eaf638b"));

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    "x-panel-token": token,
    "x-tenant-id": tenantId
  }), [token, tenantId]);

  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [err, setErr] = useState<string>("");

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => { lsSet("apiBase", apiBase); }, [apiBase]);
  useEffect(() => { lsSet("x-panel-token", token); }, [token]);
  useEffect(() => { lsSet("x-tenant-id", tenantId); }, [tenantId]);

  async function loadInbox() {
    setErr("");
    setLoadingInbox(true);
    try {
      const r = await fetch(`${apiBase}/api/inbox`, { headers });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setInbox(j.result as InboxItem[]);
      if (!selectedId && j.result?.[0]?.id) setSelectedId(j.result[0].id);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoadingInbox(false);
    }
  }

  async function loadMessages(conversationId: string) {
    setErr("");
    setLoadingMsgs(true);
    try {
      const r = await fetch(`${apiBase}/api/inbox/${conversationId}/messages`, { headers });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMessages(j.messages as Msg[]);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoadingMsgs(false);
    }
  }

  useEffect(() => { loadInbox(); }, []); // initial
  useEffect(() => { if (selectedId) loadMessages(selectedId); }, [selectedId]);

  async function send() {
    if (!selectedId) return;
    setErr("");
    const body: any = {};
    if (text.trim()) body.text = text.trim();
    if (imageUrl.trim()) body.imageUrl = imageUrl.trim();

    try {
      const r = await fetch(`${apiBase}/api/inbox/${selectedId}/reply`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setText("");
      setImageUrl("");
      await loadMessages(selectedId);
      await loadInbox();
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Panel MVP</h1>
      <p style={{ marginTop: 6, opacity: 0.8 }}>
        Inbox + historial + enviar (texto / imagen). Auth: <code>x-panel-token</code> + <code>x-tenant-id</code>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Config</h3>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>API Base</label>
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} style={{ width: "100%", padding: 8 }} />

          <label style={{ display: "block", fontSize: 12, margin: "10px 0 4px" }}>x-panel-token</label>
          <input value={token} onChange={(e) => setToken(e.target.value)} style={{ width: "100%", padding: 8 }} />

          <label style={{ display: "block", fontSize: 12, margin: "10px 0 4px" }}>x-tenant-id</label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={{ width: "100%", padding: 8 }} />

          <button onClick={loadInbox} disabled={loadingInbox} style={{ marginTop: 12, padding: "8px 12px" }}>
            {loadingInbox ? "Cargando..." : "Refrescar Inbox"}
          </button>

          {err ? <p style={{ color: "crimson" }}>{err}</p> : null}

          <hr style={{ margin: "16px 0" }} />

          <h3 style={{ margin: 0 }}>Inbox</h3>
          <div style={{ marginTop: 8, display: "grid", gap: 8, maxHeight: 520, overflow: "auto" }}>
            {inbox.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 10,
                  border: c.id === selectedId ? "2px solid #333" : "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer"
                }}
              >
                <div style={{ fontWeight: 600 }}>{c.remote_jid}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{c.status}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                  {c.last_message?.text ? c.last_message.text : c.last_message?.image_url ? "[imagen]" : "(sin mensajes)"}
                </div>
              </button>
            ))}
            {!inbox.length && !loadingInbox ? <div style={{ opacity: 0.7 }}>(Inbox vacío)</div> : null}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, minHeight: 680, display: "flex", flexDirection: "column" }}>
          <h3 style={{ marginTop: 0 }}>Chat</h3>

          <div style={{ flex: 1, border: "1px solid #eee", borderRadius: 10, padding: 12, overflow: "auto" }}>
            {loadingMsgs ? <div>Cargando...</div> : null}
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 10, display: "flex", justifyContent: m.direction === "outbound" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: 520,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fafafa"
                }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{m.direction} • {new Date(m.created_at).toLocaleString()}</div>
                  {m.text ? <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div> : null}
                  {m.image_url ? (
                    <div style={{ marginTop: 8 }}>
                      <a href={m.image_url} target="_blank">{m.image_url}</a>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {!messages.length && !loadingMsgs ? <div style={{ opacity: 0.7 }}>(Sin mensajes)</div> : null}
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <textarea placeholder="Texto..." value={text} onChange={(e) => setText(e.target.value)} rows={3} style={{ width: "100%", padding: 8 }} />
            <input placeholder="Image URL (opcional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={{ width: "100%", padding: 8 }} />
            <button onClick={send} style={{ padding: "10px 12px", fontWeight: 600 }}>Enviar</button>
          </div>
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
        Nota: este MVP persiste en DB. No integra Evolution todavía (eso va en el siguiente paso: forward + webhooks).
      </p>
    </div>
  );
}
