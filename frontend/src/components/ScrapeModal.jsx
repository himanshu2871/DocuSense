import { useState } from "react";
import { Globe, Zap, Rocket, Monitor, Check, X } from "lucide-react";

export function ScrapeModal({ onScrape, onClose }) {
  const [url,      setUrl]      = useState("");
  const [crawl,    setCrawl]    = useState(false);
  const [maxPages, setMaxPages] = useState(10);
  const [mode,     setMode]     = useState("auto");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");

  async function handleSubmit() {
    if (!url.trim()) { setErr("Please enter a URL."); return; }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setErr("URL must start with http:// or https://"); return;
    }
    setErr("");
    setLoading(true);
    try {
      await onScrape(url.trim(), crawl, maxPages, mode);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const modes = [
    {
      key: "auto",
      label: "Auto",
      icon: <Zap size={18} />,
      desc: "Detects if JS rendering is needed (recommended)",
    },
    {
      key: "fast",
      label: "Fast",
      icon: <Rocket size={18} />,
      desc: "httpx only — fastest, for simple static pages",
    },
    {
      key: "js",
      label: "JS Mode",
      icon: <Monitor size={18} />,
      desc: "Playwright browser — use for React/Vue SPAs, MSN, news sites",
    },
  ];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={20} style={{ color: "var(--text-accent)" }} />
            <h3 style={heading}>Scrape Website</h3>
          </div>
          <button style={closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div style={body}>
          {/* URL input */}
          <label style={label}>URL</label>
          <input
            style={input}
            type="url"
            placeholder="https://example.com/page"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />

          {/* Scrape mode selector */}
          <label style={{ ...label, marginTop: 20 }}>Scrape mode</label>
          <div style={modeGrid}>
            {modes.map((m) => (
              <div
                key={m.key}
                style={modeCard(mode === m.key)}
                onClick={() => setMode(m.key)}
              >
                <div style={modeTop}>
                  <span style={{ color: mode === m.key ? "var(--text-accent)" : "var(--text-secondary)", display: "flex", alignItems: "center" }}>
                    {m.icon}
                  </span>
                  <span style={modeLabel(mode === m.key)}>{m.label}</span>
                  {mode === m.key && <Check size={16} style={modeTick} />}
                </div>
                <p style={modeDesc}>{m.desc}</p>
              </div>
            ))}
          </div>

          {/* JS mode tip */}
          {mode === "js" && (
            <div style={tip}>
              <Monitor size={14} style={{ marginRight: 6, flexShrink: 0 }} />
              Playwright launches a real browser — takes 5–15s but works on any site including SPAs and news portals.
            </div>
          )}

          {/* Crawl toggle */}
          <label style={{ ...label, marginTop: 20, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={crawl}
              onChange={(e) => setCrawl(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--bg-accent)" }}
            />
            Crawl entire site (same domain)
          </label>

          {crawl && (
            <div style={{ marginTop: 12, background: "var(--bg-hover)", padding: "16px", borderRadius: 16 }}>
              <label style={label}>Max pages: <strong style={{ color: "var(--text-accent)" }}>{maxPages}</strong></label>
              <input
                type="range" min={1} max={50} value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--bg-accent)", marginTop: 8 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                <span>1</span><span>50</span>
              </div>
            </div>
          )}

          {err && <p style={errStyle}>{err}</p>}
        </div>

        <div style={actions}>
          <button style={cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button style={submitBtn(loading)} onClick={handleSubmit} disabled={loading}>
            {loading
              ? (mode === "js" ? "Launching browser…" : crawl ? "Crawling…" : "Scraping…")
              : mode === "js" ? "Scrape with JS"
              : crawl ? "Crawl site" : "Scrape URL"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const overlay   = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(2px)" };
const modal     = { background: "var(--bg-card)", borderRadius: 24, width: 460, boxShadow: "var(--shadow-lg)", maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column" };
const header    = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-card)", zIndex: 1, position: "sticky", top: 0 };
const heading   = { margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text-primary)" };
const closeBtn  = { background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", padding: 4, borderRadius: "50%", transition: "background 0.2s" };
const body      = { padding: "24px" };
const label     = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 };
const input     = { width: "100%", padding: "12px 16px", borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-hover)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };
const modeGrid  = { display: "flex", flexDirection: "column", gap: 8 };
const modeCard  = (active) => ({
  border: `1.5px solid ${active ? "var(--border-active)" : "var(--border-color)"}`,
  borderRadius: 16, padding: "12px 16px", cursor: "pointer",
  background: active ? "var(--bg-active)" : "var(--bg-card)",
  transition: "all 0.2s",
});
const modeTop   = { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 };
const modeLabel = (active) => ({ fontSize: 14, fontWeight: 600, color: active ? "var(--text-accent)" : "var(--text-primary)", flex: 1 });
const modeTick  = { color: "var(--text-accent)" };
const modeDesc  = { fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 };
const tip       = { background: "var(--status-proc-bg)", border: "1px solid var(--status-proc-text)", borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "var(--status-proc-text)", marginTop: 12, display: "flex", alignItems: "flex-start", lineHeight: 1.4 };
const errStyle  = { color: "var(--status-err-text)", fontSize: 13, marginTop: 16, textAlign: "center" };
const actions   = { display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 24px", borderTop: "1px solid var(--border-color)", background: "var(--bg-main)", position: "sticky", bottom: 0, zIndex: 1 };
const cancelBtn = { padding: "10px 24px", borderRadius: 24, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)", fontWeight: 600, transition: "background 0.2s" };
const submitBtn = (disabled) => ({ padding: "10px 24px", borderRadius: 24, border: "none", background: disabled ? "var(--bg-secondary)" : "var(--bg-accent)", color: disabled ? "var(--text-secondary)" : "#fff", cursor: disabled ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s" });
