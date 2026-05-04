import { useEffect, useRef, useState } from "react";
import { getAccessToken } from "../context/AuthContext";
import { MessageSquare, Paperclip, Send, Square, Menu, User, Bot, Globe, FileText } from "lucide-react";

const BASE = "http://localhost:8000";

export function ChatWindow({
  activeSession, messages, loading,
  selectedDocIds, documents,
  onSend, onNewSession, onToggleSidebar
}) {
  const [input,       setInput]       = useState("");
  const [streaming,   setStreaming]   = useState(false);
  const [streamText,  setStreamText]  = useState("");
  const [streamSrcs,  setStreamSrcs]  = useState([]);
  const [confidence,  setConfidence]  = useState(null);
  const endRef   = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, loading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleSend() {
    const q = input.trim();
    if (!q || loading || streaming) return;
    setInput("");
    onSend(q, selectedDocIds, _startStream);
  }

  async function _startStream(query, docIds, sessionId) {
    setStreaming(true);
    setStreamText("");
    setStreamSrcs([]);
    setConfidence(null);
    abortRef.current = new AbortController();

    try {
      const token = getAccessToken();
      const res   = await fetch(`${BASE}/chat/stream`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body:   JSON.stringify({ session_id: sessionId, query, doc_ids: docIds }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Stream failed" }));
        throw new Error(err.detail || "Stream failed");
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "meta") {
              setStreamSrcs(event.sources || []);
              if (event.confidence != null) setConfidence(event.confidence);
            } else if (event.type === "token") {
              setStreamText((prev) => prev + event.content);
            } else if (event.type === "done") {
              setStreaming(false);
              setStreamText("");
              setStreamSrcs([]);
              // Reload session from DB to get persisted messages
              onSend(null, null, null);
            } else if (event.type === "error") {
              throw new Error(event.content);
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Stream error:", e.message);
      }
      setStreaming(false);
      setStreamText("");
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const scopeLabel =
    selectedDocIds.length === 0
      ? "All documents"
      : documents.filter((d) => selectedDocIds.includes(d.id)).map((d) => d.filename).join(", ")
      || "Selected documents";

  if (!activeSession) {
    return (
      <main style={main}>
        <div style={header}>
          <button className="mobile-menu-btn" style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "var(--text-accent)" }} onClick={onToggleSidebar}>
            <Menu size={24} />
          </button>
        </div>
        <div style={emptyState}>
          <MessageSquare size={48} color="var(--text-secondary)" />
          <p style={{ fontWeight: 600, fontSize: 18, color: "var(--text-primary)" }}>Start a new chat</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 320, textAlign: "center", lineHeight: 1.5 }}>
            Upload a PDF or scrape a website, then start a new chat.
          </p>
          <button style={startBtn} onClick={onNewSession}>+ New chat</button>
        </div>
      </main>
    );
  }

  return (
    <main style={main}>
      {/* Header */}
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="mobile-menu-btn" style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "var(--text-accent)" }} onClick={onToggleSidebar}>
            <Menu size={24} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
            {activeSession.title}
          </span>
          <span style={scopePill}>
            <Paperclip size={12} style={{ marginRight: 4 }} />
            {scopeLabel}
          </span>
        </div>
        {streaming && <span style={streamingBadge}>● Streaming</span>}
      </div>

      {/* Messages */}
      <div style={messagesArea}>
        {messages.length === 0 && !streaming && !loading && (
          <div style={emptyChat}><p>Ask anything about your documents.</p></div>
        )}

        {loading && messages.length === 0 && (
          <>
            <div style={row("user")}>
               <div style={avatar}><User size={18} /></div>
               <div style={{ ...bubble("user"), width: 120, height: 44, background: "var(--bg-accent)", animation: "pulse 1.5s infinite ease-in-out" }} />
            </div>
            <div style={row("assistant")}>
               <div style={avatar}><Bot size={18} /></div>
               <div style={{ ...bubble("assistant"), width: 200, height: 60, background: "var(--bg-hover)", animation: "pulse 1.5s infinite ease-in-out" }} />
            </div>
          </>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={row(msg.role)}>
            {msg.role === "assistant" && <div style={{ ...avatar, background: "var(--bg-hover)", color: "var(--text-primary)" }}><Bot size={18} /></div>}
            <div style={bubble(msg.role)}>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                {msg.content}
              </p>
              {/* Confidence badge */}
              {msg.role === "assistant" && msg.confidence != null && (
                <div style={confidenceBadge(msg.confidence)}>
                  {confidenceLabel(msg.confidence)}
                </div>
              )}
              {msg.sources?.length > 0 && (
                <div style={sourcesBox}>
                  <span style={{ fontWeight: 600, fontSize: 11 }}>Sources</span>
                  {msg.sources.map((s, j) => (
                    <div key={j} style={sourceItem}>
                      {s.startsWith("http") ? (
                        <a href={s} target="_blank" rel="noreferrer" style={sourceLink}>
                          <Globe size={12} style={{ marginRight: 4 }} />
                          {s.replace(/^https?:\/\//, "").slice(0, 60)}
                        </a>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center" }}>
                          <FileText size={12} style={{ marginRight: 4 }} />
                          {s}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && <div style={{ ...avatar, background: "var(--bg-accent)", color: "#fff" }}><User size={18} /></div>}
          </div>
        ))}

        {/* Live streaming bubble */}
        {streaming && (
          <div style={row("assistant")}>
            <div style={{ ...avatar, background: "var(--bg-hover)", color: "var(--text-primary)" }}><Bot size={18} /></div>
            <div style={bubble("assistant")}>
              {streamText ? (
                <>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                    {streamText}
                    {/* Blinking cursor — inline span, no broken object */}
                    <span style={cursorStyle} />
                  </p>
                  {streamSrcs.length > 0 && (
                    <div style={sourcesBox}>
                      <span style={{ fontWeight: 600, fontSize: 11 }}>Sources</span>
                      {streamSrcs.map((s, j) => (
                        <div key={j} style={sourceItem}>
                          {s.startsWith("http")
                            ? <a href={s} target="_blank" rel="noreferrer" style={sourceLink}>
                                <Globe size={12} style={{ marginRight: 4 }} />
                                {s.replace(/^https?:\/\//, "").slice(0, 60)}
                              </a>
                            : <span style={{ display: "flex", alignItems: "center" }}><FileText size={12} style={{ marginRight: 4 }} /> {s}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Thinking dots — proper inline JSX, not a broken object */
                <span style={{ display: "inline-flex", gap: 4 }}>
                  <span style={dotStyle(0)}>•</span>
                  <span style={dotStyle(1)}>•</span>
                  <span style={dotStyle(2)}>•</span>
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={inputRow}>
        <textarea
          style={inputBox}
          rows={1}
          value={input}
          placeholder={
            documents.length === 0
              ? "Upload a PDF or scrape a URL first…"
              : "Ask a question… (Enter to send, Shift+Enter for newline)"
          }
          disabled={loading || streaming || documents.length === 0}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {streaming ? (
          <button
            style={stopBtn}
            onClick={() => { abortRef.current?.abort(); setStreaming(false); setStreamText(""); }}
            title="Stop generating"
          ><Square size={20} fill="currentColor" /></button>
        ) : (
          <button
            style={sendBtnStyle(!input.trim() || loading || documents.length === 0)}
            disabled={!input.trim() || loading || documents.length === 0}
            onClick={handleSend}
          ><Send size={18} style={{ marginLeft: 2 }} /></button>
        )}
      </div>

      {/* CSS for cursor blink and dot bounce */}
      <style>{`
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes bounce  { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>
    </main>
  );
}

// ── Confidence helpers ────────────────────────────────────────────────────────
function confidenceLabel(score) {
  if (score >= 0.75) return `High confidence · ${Math.round(score * 100)}%`;
  if (score >= 0.5)  return `Medium confidence · ${Math.round(score * 100)}%`;
  return `Low confidence · ${Math.round(score * 100)}%`;
}

function confidenceBadge(score) {
  const color = score >= 0.75 ? "var(--status-ready-text)" : score >= 0.5 ? "var(--status-proc-text)" : "var(--status-err-text)";
  const bg    = score >= 0.75 ? "var(--status-ready-bg)" : score >= 0.5 ? "var(--status-proc-bg)" : "var(--status-err-bg)";
  return {
    display: "inline-block", marginTop: 8,
    fontSize: 11, fontWeight: 600,
    padding: "4px 10px", borderRadius: 20,
    background: bg, color,
  };
}

// ── Inline animated styles (no className needed) ──────────────────────────────
const cursorStyle = {
  display: "inline-block",
  width: 2, height: "1em",
  background: "var(--text-primary)",
  marginLeft: 2,
  verticalAlign: "text-bottom",
  animation: "blink 1s step-end infinite",
};

const dotStyle = (i) => ({
  display: "inline-block",
  fontSize: 22,
  color: "var(--text-secondary)",
  animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
});

// ── Layout styles ─────────────────────────────────────────────────────────────
const main         = { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-main)" };
const header       = { padding: "16px 24px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "space-between" };
const scopePill    = { marginLeft: 10, fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-hover)", borderRadius: 20, padding: "4px 12px", display: "flex", alignItems: "center" };
const streamingBadge = { fontSize: 12, color: "var(--status-ready-text)", fontWeight: 500 };
const messagesArea = { flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 };
const emptyState   = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, height: "100%" };
const emptyChat    = { color: "var(--text-secondary)", fontSize: 15, textAlign: "center", marginTop: 60 };
const startBtn     = { marginTop: 8, padding: "12px 28px", background: "var(--bg-accent)", color: "#fff", border: "none", borderRadius: 24, cursor: "pointer", fontWeight: 600, fontSize: 14 };
const row          = (role) => ({ display: "flex", flexDirection: role === "user" ? "row-reverse" : "row", alignItems: "flex-end", gap: 12 });
const avatar       = { width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const bubble       = (role) => ({ maxWidth: "75%", padding: "14px 20px", borderRadius: role === "user" ? "24px 24px 4px 24px" : "24px 24px 24px 4px", background: role === "user" ? "var(--bg-accent)" : "var(--bg-card)", color: role === "user" ? "#fff" : "var(--text-primary)", boxShadow: "var(--shadow-sm)", fontSize: 15, border: role === "assistant" ? "1px solid var(--border-color)" : "none" });
const sourcesBox   = { marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-color)", fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 6 };
const sourceItem   = { paddingLeft: 4, display: "flex", alignItems: "center" };
const sourceLink   = { color: "var(--text-accent)", textDecoration: "none", display: "flex", alignItems: "center" };
const inputRow     = { display: "flex", gap: 12, padding: "16px 24px", borderTop: "1px solid var(--border-color)", background: "var(--bg-card)", alignItems: "flex-end" };
const inputBox     = { flex: 1, padding: "14px 20px", borderRadius: 24, border: "1px solid var(--border-color)", fontSize: 15, outline: "none", resize: "none", fontFamily: "inherit", background: "var(--bg-hover)", color: "var(--text-primary)", lineHeight: 1.5, transition: "border-color 0.2s" };
const sendBtnStyle = (disabled) => ({ width: 48, height: 48, borderRadius: "50%", border: "none", background: disabled ? "var(--bg-hover)" : "var(--bg-accent)", color: disabled ? "var(--text-secondary)" : "#fff", cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" });
const stopBtn      = { width: 48, height: 48, borderRadius: "50%", border: "none", background: "var(--status-err-bg)", color: "var(--status-err-text)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" };
