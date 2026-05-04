import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Zap, Eye, EyeOff } from "lucide-react";

export function AuthPage() {
  const [mode, setMode]         = useState("login"); // "login" | "register"
  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const { login, register, loading, error, setError } = useAuth();

  function switchMode(m) {
    setMode(m);
    setError("");
    setEmail("");
    setUsername("");
    setPassword("");
  }

  async function handleSubmit() {
    if (!email || !password) return;
    if (mode === "register" && !username) return;

    const ok = mode === "login"
      ? await login(email, password)
      : await register(email, username, password);

    if (!ok) return; // error shown via context
  }

  function onKeyDown(e) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div style={page}>
      <div style={card}>
        {/* Logo */}
        <div style={logoWrap}>
          <Zap size={32} style={{ color: "var(--bg-accent)" }} />
          <span style={logoText}>DocuSense</span>
        </div>
        <p style={tagline}>Chat with your documents using AI</p>

        {/* Tab switcher */}
        <div style={tabRow}>
          <button style={tabBtn(mode === "login")}    onClick={() => switchMode("login")}>Sign in</button>
          <button style={tabBtn(mode === "register")} onClick={() => switchMode("register")}>Create account</button>
        </div>

        {/* Form */}
        <div style={form}>
          <div style={fieldWrap}>
            <label style={label}>Email</label>
            <input
              style={input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
            />
          </div>

          {mode === "register" && (
            <div style={fieldWrap}>
              <label style={label}>Username</label>
              <input
                style={input}
                type="text"
                placeholder="yourname"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
          )}

          <div style={fieldWrap}>
            <label style={label}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...input, paddingRight: 40 }}
                type={showPass ? "text" : "password"}
                placeholder={mode === "register" ? "Min 6 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                style={eyeBtn}
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={errorBox}>
              <span style={{ marginRight: 6 }}>⚠️</span> {error}
            </div>
          )}

          <button
            style={submitBtn(loading)}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? (mode === "login" ? "Signing in…" : "Creating account…")
              : (mode === "login" ? "Sign in" : "Create account")}
          </button>
        </div>

        <p style={footer}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <span
            style={footerLink}
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </span>
        </p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const page = {
  height: "100vh", display: "flex", alignItems: "center", width: "100vw",
  justifyContent: "center", background: "var(--bg-main)",
  fontFamily: "'Inter', -apple-system, sans-serif",
};
const card = {
  background: "var(--bg-card)", borderRadius: 32, padding: "40px 32px",
  width: 380, boxShadow: "var(--shadow-lg)",
  border: "1px solid var(--border-color)",
};
const logoWrap = { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 };
const logoText = { fontSize: 26, fontWeight: 700, color: "var(--text-primary)" };
const tagline  = { fontSize: 14, color: "var(--text-secondary)", margin: "0 0 32px", textAlign: "center" };
const tabRow   = {
  display: "flex", background: "var(--bg-hover)", borderRadius: 24,
  padding: 4, marginBottom: 28, gap: 4,
};
const tabBtn = (active) => ({
  flex: 1, padding: "10px 0", border: "none", borderRadius: 20,
  cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 500,
  background: active ? "var(--bg-card)" : "transparent",
  color: active ? "var(--text-primary)" : "var(--text-secondary)",
  boxShadow: active ? "var(--shadow-sm)" : "none",
  transition: "all 0.2s",
});
const form     = { display: "flex", flexDirection: "column", gap: 20 };
const fieldWrap = { display: "flex", flexDirection: "column", gap: 8 };
const label    = { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" };
const input    = {
  padding: "12px 16px", borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-hover)", color: "var(--text-primary)",
  fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
  transition: "border-color 0.2s",
};
const eyeBtn = {
  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)",
  padding: 0, lineHeight: 1, display: "flex", alignItems: "center",
};
const errorBox = {
  background: "var(--status-err-bg)", border: "1px solid var(--status-err-text)",
  borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "var(--status-err-text)", display: "flex", alignItems: "center"
};
const submitBtn = (disabled) => ({
  padding: "14px 0", borderRadius: 24, border: "none",
  background: disabled ? "var(--bg-secondary)" : "var(--bg-accent)",
  color: disabled ? "var(--text-secondary)" : "#fff",
  fontWeight: 600, fontSize: 15, cursor: disabled ? "not-allowed" : "pointer",
  transition: "all 0.2s", marginTop: 8,
});
const footer     = { textAlign: "center", fontSize: 14, color: "var(--text-secondary)", marginTop: 24 };
const footerLink = { color: "var(--text-accent)", fontWeight: 600, cursor: "pointer" };
