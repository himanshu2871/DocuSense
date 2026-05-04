import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { UploadModal } from "./UploadModal";
import { ScrapeModal } from "./ScrapeModal";
import { Zap, LogOut, FileText, Globe, MessageSquare, Folder, Plus, Trash2, Sun, Moon, CheckSquare, Square, Check } from "lucide-react";

export function Sidebar({
  documents, loadingDocs, sessions, activeSession, selectedDocIds,
  showSidebar, onCloseSidebar, theme, onToggleTheme,
  onSelectDoc, onLoadSession, onNewSession,
  onDeleteSession, onBulkDeleteSessions,
  onDeleteDoc, onUpload, onScrape,
}) {
  const { user, logout } = useAuth();

  const [tab, setTab]                     = useState("docs");
  const [showUpload, setShowUpload]       = useState(false);
  const [showScrape, setShowScrape]       = useState(false);
  const [selectMode, setSelectMode]       = useState(false);
  const [selectedSessions, setSelected]  = useState([]);
  const [confirmBulk, setConfirmBulk]    = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  function toggleSelect(id) {
    setSelected((p) => p.includes(id) ? p.filter((s) => s !== id) : [...p, id]);
  }
  function toggleAll() {
    setSelected((p) => p.length === sessions.length ? [] : sessions.map((s) => s.id));
  }
  function exitSelect() {
    setSelectMode(false); setSelected([]); setConfirmBulk(false);
  }
  async function handleBulkDelete() {
    await onBulkDeleteSessions(selectedSessions);
    exitSelect();
  }

  const statusBadge = (doc) => {
    const map = {
      ready:      { bg: "var(--status-ready-bg)", color: "var(--status-ready-text)" },
      processing: { bg: "var(--status-proc-bg)", color: "var(--status-proc-text)" },
      error:      { bg: "var(--status-err-bg)", color: "var(--status-err-text)" },
    };
    const s = map[doc.status] || map.ready;
    return <span style={{ ...badge, background: s.bg, color: s.color }}>{doc.status}</span>;
  };

  return (
    <>
      {showSidebar && <div className="sidebar-overlay" onClick={onCloseSidebar} />}
      <aside className={`sidebar-container ${showSidebar ? "open" : ""}`} style={sidebar}>
      {/* ── Header ── */}
      <div style={header}>
        <div style={logoRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={22} style={{ color: "var(--text-accent)" }} />
            <span style={logo}>DocuSense</span>
          </div>
          <button style={themeBtn} onClick={onToggleTheme} title="Toggle Theme">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* User info + logout */}
        {user && (
          <div style={userRow}>
            <div style={avatar}>{user.username[0].toUpperCase()}</div>
            <span style={username} title={user.username}>
              {user.username.length > 14 ? user.username.slice(0, 14) + "…" : user.username}
            </span>
            {!showLogoutConfirm ? (
              <button style={logoutBtn} onClick={() => setShowLogoutConfirm(true)} title="Sign out">
                <LogOut size={16} />
              </button>
            ) : (
              <div style={logoutConfirm}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Sign out?</span>
                <button style={logoutYes} onClick={logout}>Yes</button>
                <button style={logoutNo} onClick={() => setShowLogoutConfirm(false)}>No</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={tabs}>
        {["docs", "sessions"].map((t) => (
          <button key={t} style={tabBtn(tab === t)}
            onClick={() => { setTab(t); exitSelect(); }}>
            {t === "docs" ? "Documents" : "Chats"}
          </button>
        ))}
      </div>

      {/* ── Documents tab ── */}
      {tab === "docs" && (
        <>
          <div style={btnGroup}>
            <button style={actionBtn("var(--bg-accent)")} onClick={() => setShowUpload(true)}>
              <Plus size={16} /> Upload PDF
            </button>
            <button style={actionBtn("var(--text-accent)")} onClick={() => setShowScrape(true)}>
              <Globe size={16} /> Scrape URL
            </button>
          </div>
          <p style={sectionLabel}>{documents.length} document{documents.length !== 1 ? "s" : ""}</p>
          <div style={docItem(selectedDocIds.length === 0)} onClick={() => onSelectDoc(null)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Folder size={16} />
              <span>All documents</span>
            </div>
            <span style={chip}>{documents.length}</span>
          </div>
          <div style={scrollArea}>
            {loadingDocs ? (
              <>
                <div style={skeletonItem} />
                <div style={skeletonItem} />
                <div style={skeletonItem} />
              </>
            ) : documents.length === 0 ? (
              <div style={emptyDocsState}>
                <Folder size={32} style={emptyIcon} />
                <p style={emptyTitle}>No documents yet</p>
                <p style={emptyText}>Upload a PDF or scrape a website to start building your knowledge base.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} style={docItem(selectedDocIds.includes(doc.id))}>
                  <div style={docName} onClick={() => onSelectDoc(doc.id)} title={doc.filename}>
                    {doc.source_type === "url" ? <Globe size={14} /> : <FileText size={14} />}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.filename.length > 22 ? doc.filename.slice(0, 22) + "…" : doc.filename}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {statusBadge(doc)}
                    <button style={deleteBtn} onClick={() => onDeleteDoc(doc.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── Sessions tab ── */}
      {tab === "sessions" && (
        <>
          {!selectMode ? (
            <div style={btnGroup}>
              <button style={actionBtn("var(--bg-accent)")} onClick={onNewSession}>
                <Plus size={16} /> New chat
              </button>
              {sessions.length > 0 && (
                <button style={actionBtn("var(--bg-secondary)")} onClick={() => setSelectMode(true)}>
                  <CheckSquare size={16} style={{ color: "var(--text-primary)" }} /> <span style={{ color: "var(--text-primary)" }}>Select</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <div style={selectToolbar}>
                <button style={selectAllBtn} onClick={toggleAll}>
                  {selectedSessions.length === sessions.length ? "Deselect all" : "Select all"}
                </button>
                <button style={cancelSelBtn} onClick={exitSelect}>Cancel</button>
              </div>
              {selectedSessions.length > 0 && !confirmBulk && (
                <button style={bulkDeleteBtn} onClick={() => setConfirmBulk(true)}>
                  Delete {selectedSessions.length} chat{selectedSessions.length !== 1 ? "s" : ""}
                </button>
              )}
              {confirmBulk && (
                <div style={confirmBox}>
                  <p style={confirmText}>
                    Delete {selectedSessions.length} chat{selectedSessions.length !== 1 ? "s" : ""}? Cannot be undone.
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={confirmCancelBtn} onClick={() => setConfirmBulk(false)}>Cancel</button>
                    <button style={confirmDeleteBtn} onClick={handleBulkDelete}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p style={sectionLabel}>
            {sessions.length} chat{sessions.length !== 1 ? "s" : ""}
            {selectMode && selectedSessions.length > 0 && (
              <span style={{ color: "var(--text-accent)", marginLeft: 6 }}>({selectedSessions.length} selected)</span>
            )}
          </p>

          <div style={scrollArea}>
            {sessions.map((s) => (
              <div
                key={s.id}
                style={sessionItem(activeSession?.id === s.id && !selectMode, selectMode && selectedSessions.includes(s.id))}
                onClick={() => selectMode ? toggleSelect(s.id) : onLoadSession(s)}
              >
                {selectMode && (
                  <div style={checkbox(selectedSessions.includes(s.id))}>
                    {selectedSessions.includes(s.id) && <Check size={12} color="#fff" />}
                  </div>
                )}
                <div style={docName} title={s.title}>
                  <MessageSquare size={14} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title.length > 22 ? s.title.slice(0, 22) + "…" : s.title}
                  </span>
                </div>
                {!selectMode && (
                  <button style={deleteBtn} onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {sessions.length === 0 && <p style={empty}>No chats yet. Start a new one above.</p>}
          </div>
        </>
      )}

      {showUpload && <UploadModal onUpload={onUpload} onClose={() => setShowUpload(false)} />}
      {showScrape && <ScrapeModal onScrape={onScrape} onClose={() => setShowScrape(false)} />}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </aside>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const sidebar    = { width: 280, background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column", padding: "16px", gap: 6, overflowY: "hidden", transition: "background 0.3s, border-color 0.3s" };
const header     = { marginBottom: 12 };
const logoRow    = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 };
const logo       = { fontSize: 18, fontWeight: 700, color: "var(--text-accent)" };
const themeBtn   = { background: "var(--bg-hover)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)", transition: "all 0.2s" };
const userRow    = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg-hover)", borderRadius: 24 };
const avatar     = { width: 28, height: 28, borderRadius: "50%", background: "var(--bg-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 };
const username   = { flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const logoutBtn  = { background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4, flexShrink: 0, display: "flex", alignItems: "center" };
const logoutConfirm = { display: "flex", alignItems: "center", gap: 4 };
const logoutYes  = { padding: "4px 10px", background: "var(--status-err-bg)", color: "var(--status-err-text)", border: "none", borderRadius: 16, cursor: "pointer", fontSize: 11, fontWeight: 600 };
const logoutNo   = { padding: "4px 10px", background: "var(--bg-secondary)", color: "var(--text-primary)", border: "none", borderRadius: 16, cursor: "pointer", fontSize: 11 };
const tabs       = { display: "flex", gap: 4, marginBottom: 12, background: "var(--bg-hover)", padding: 4, borderRadius: 24 };
const tabBtn     = (a) => ({ flex: 1, padding: "8px 0", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: a ? 600 : 500, background: a ? "var(--bg-card)" : "transparent", color: a ? "var(--text-accent)" : "var(--text-secondary)", boxShadow: a ? "var(--shadow-sm)" : "none", transition: "all 0.2s" });
const btnGroup   = { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 };
const actionBtn  = (bg) => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", background: bg, color: "#fff", border: "none", borderRadius: 24, cursor: "pointer", fontWeight: 600, fontSize: 14, transition: "transform 0.1s", opacity: 0.95 });
const sectionLabel = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 8px 8px" };
const scrollArea = { flex: 1, overflowY: "auto" };
const docItem    = (a) => ({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 16, cursor: "pointer", fontSize: 13, background: a ? "var(--bg-active)" : "transparent", fontWeight: a ? 600 : 500, gap: 8, marginBottom: 4, color: a ? "var(--text-accent)" : "var(--text-primary)", transition: "background 0.2s" });
const sessionItem = (a, sel) => ({ display: "flex", alignItems: "center", padding: "10px 12px", borderRadius: 16, cursor: "pointer", fontSize: 13, background: sel ? "var(--bg-active)" : a ? "var(--bg-active)" : "transparent", fontWeight: a ? 600 : 500, marginBottom: 4, gap: 10, color: a ? "var(--text-accent)" : "var(--text-primary)", border: sel ? "1px solid var(--border-active)" : "1px solid transparent", transition: "all 0.2s" });
const docName    = { flex: 1, display: "flex", alignItems: "center", gap: 8, overflow: "hidden" };
const chip       = { background: "var(--bg-hover)", color: "var(--text-accent)", borderRadius: 16, padding: "2px 8px", fontSize: 11, fontWeight: 600, flexShrink: 0 };
const badge      = { borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 600, flexShrink: 0, textTransform: "capitalize" };
const deleteBtn  = { background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4, display: "flex", alignItems: "center", borderRadius: "50%" };
const empty      = { fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginTop: 24, padding: "0 12px" };
const selectToolbar  = { display: "flex", gap: 8, marginBottom: 8 };
const selectAllBtn   = { flex: 1, padding: "8px 0", background: "var(--bg-active)", border: "none", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-accent)" };
const cancelSelBtn   = { padding: "8px 16px", background: "transparent", border: "1px solid var(--border-color)", borderRadius: 20, cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" };
const bulkDeleteBtn  = { width: "100%", padding: "10px 0", background: "var(--status-err-bg)", border: "none", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--status-err-text)", marginBottom: 8 };
const confirmBox     = { background: "var(--status-err-bg)", border: "1px solid var(--status-err-text)", borderRadius: 16, padding: "12px 16px", marginBottom: 8 };
const confirmText    = { fontSize: 13, color: "var(--status-err-text)", marginBottom: 12, lineHeight: 1.4, fontWeight: 500 };
const confirmCancelBtn = { flex: 1, padding: "8px 0", background: "var(--bg-card)", border: "none", borderRadius: 20, cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" };
const confirmDeleteBtn = { flex: 1, padding: "8px 0", background: "var(--status-err-text)", border: "none", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" };
const checkbox = (c) => ({ width: 18, height: 18, borderRadius: 6, flexShrink: 0, border: c ? "none" : "1.5px solid var(--border-color)", background: c ? "var(--bg-accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" });

const skeletonItem = { height: 36, borderRadius: 16, background: "var(--bg-hover)", marginBottom: 8, animation: "pulse 1.5s infinite ease-in-out" };
const emptyDocsState = { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginTop: 40, padding: "0 16px" };
const emptyIcon = { marginBottom: 12, color: "var(--text-secondary)" };
const emptyTitle = { fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 };
const emptyText = { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 };
