import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { setUnauthorizedHandler } from "./api/client";
import { AuthPage } from "./components/AuthPage";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { useDocuments } from "./hooks/useDocuments";
import { useChat } from "./hooks/useChat";

// Inner app — only rendered when user is logged in
function AppInner() {
  const { user, logout } = useAuth();

  const { documents, upload, remove, scrape, refresh, error: docsError, loading: loadingDocs } = useDocuments();
  const {
    sessions, activeSession, messages, loading: chatLoading, error: chatError,
    refreshSessions, loadSession, newSession,
    deleteSession, bulkDeleteSessions, sendMessage,
  } = useChat();

  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [toast, setToast]                   = useState(null);
  const [showSidebar, setShowSidebar]       = useState(false);
  const [theme, setTheme]                   = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Redirect to login on 401
  useEffect(() => {
    setUnauthorizedHandler(() => logout());
  }, [logout]);

  // Load data on mount
  useEffect(() => {
    refresh();
    refreshSessions();
  }, []);

  useEffect(() => {
    if (docsError) showToast(docsError, "error");
  }, [docsError]);

  useEffect(() => {
    if (chatError) showToast(chatError, "error");
  }, [chatError]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleUpload(file) {
    const doc = await upload(file);
    showToast(`"${doc.filename}" indexed — ${doc.chunk_count} chunks.`);
  }

  async function handleScrape(url, crawl, maxPages) {
    const job = await scrape(url, crawl, maxPages);
    showToast(`Scraped ${job.pages_scraped} page(s) from ${url}.`);
  }

  async function handleDeleteDoc(docId) {
    const doc = documents.find((d) => d.id === docId);
    if (!confirm(`Delete "${doc?.filename}"?`)) return;
    await remove(docId);
    setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
    showToast(`"${doc?.filename}" removed.`, "info");
  }

  function handleSelectDoc(docId) {
    setSelectedDocIds((prev) =>
      docId === null ? [] :
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [docId]
    );
  }

  return (
    <div style={layout} className="app-layout">
      <Sidebar
        documents={documents}
        loadingDocs={loadingDocs}
        sessions={sessions}
        activeSession={activeSession}
        selectedDocIds={selectedDocIds}
        showSidebar={showSidebar}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === "light" ? "dark" : "light")}
        onCloseSidebar={() => setShowSidebar(false)}
        onSelectDoc={handleSelectDoc}
        onLoadSession={loadSession}
        onNewSession={() => newSession(selectedDocIds)}
        onDeleteSession={deleteSession}
        onBulkDeleteSessions={bulkDeleteSessions}
        onDeleteDoc={handleDeleteDoc}
        onUpload={handleUpload}
        onScrape={handleScrape}
      />
      <ChatWindow
        activeSession={activeSession}
        messages={messages}
        loading={chatLoading}
        selectedDocIds={selectedDocIds}
        documents={documents}
        onSend={sendMessage}
        onNewSession={() => newSession(selectedDocIds)}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
      />
      {toast && (
        <div style={toastStyle(toast.type)}>
          {toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : "ℹ️"} {toast.msg}
        </div>
      )}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-container {
            position: absolute;
            z-index: 100;
            height: 100%;
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out;
            box-shadow: 4px 0 15px rgba(0,0,0,0.1);
          }
          .sidebar-container.open {
            transform: translateX(0);
          }
          .sidebar-overlay {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 99;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}

// Root — shows AuthPage if not logged in, AppInner if logged in
function AppRoot() {
  const { user } = useAuth();
  return user ? <AppInner /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}

const layout = {
  display: "flex", height: "100vh", width: "100vw",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  background: "var(--bg-main)", color: "var(--text-primary)",
};
const toastStyle = (type) => ({
  position: "fixed", bottom: 24, right: 24, zIndex: 200,
  background: type === "success" ? "var(--status-ready-text)" : type === "error" ? "var(--status-err-text)" : "var(--bg-accent)",
  color: "#fff", padding: "14px 24px", borderRadius: 32,
  fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-md)",
  maxWidth: 380,
});
