import { useState, useCallback } from "react";
import { api } from "../api/client";

export function useChat() {
  const [sessions,      setSessions]      = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");

  const refreshSessions = useCallback(async () => {
    try {
      const list = await api.listSessions();
      setSessions(list);
    } catch (e) { setError(e.message); }
  }, []);

  const loadSession = useCallback(async (session) => {
    setActiveSession(session);
    try {
      const full = await api.getSession(session.id);
      setMessages(full.messages || []);
    } catch (e) { setError(e.message); }
  }, []);

  const newSession = useCallback(async (docIds = []) => {
    try {
      const session = await api.createSession(docIds);
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
      return session;
    } catch (e) { setError(e.message); }
  }, []);

  const deleteSession = useCallback(async (sessionId) => {
    try {
      await api.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (e) { setError(e.message); }
  }, [activeSession]);

  const bulkDeleteSessions = useCallback(async (sessionIds) => {
    try {
      await api.bulkDeleteSessions(sessionIds);
      setSessions((prev) => prev.filter((s) => !sessionIds.includes(s.id)));
      if (activeSession && sessionIds.includes(activeSession.id)) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (e) { setError(e.message); throw e; }
  }, [activeSession]);

  const renameSession = useCallback(async (sessionId, title) => {
    try {
      await api.renameSession(sessionId, title);
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title } : s));
      if (activeSession?.id === sessionId)
        setActiveSession((s) => ({ ...s, title }));
    } catch (e) { setError(e.message); }
  }, [activeSession]);

  /**
   * sendMessage — called by ChatWindow.
   *
   * When streamCallback is provided (Day 10+):
   *   - Adds optimistic user message to UI
   *   - Calls streamCallback(query, docIds, sessionId) to kick off SSE
   *   - When called with (null, null, null) signals stream done → reload session
   *
   * When streamCallback is null (fallback):
   *   - Uses standard non-streaming /chat endpoint
   */
  const sendMessage = useCallback(async (query, docIds = [], streamCallback = null) => {
    if (!activeSession) return;

    // Signal from ChatWindow that stream finished — reload session from DB
    if (query === null) {
      try {
        const full = await api.getSession(activeSession.id);
        setMessages(full.messages || []);
        // Update session title in sidebar if it was auto-set
        const updated = full.title;
        if (updated && updated !== "New chat") {
          setSessions((prev) =>
            prev.map((s) => s.id === activeSession.id ? { ...s, title: updated } : s)
          );
          setActiveSession((s) => ({ ...s, title: updated }));
        }
      } catch (e) { setError(e.message); }
      return;
    }

    setError("");

    // Add user message optimistically
    const userMsg = { role: "user", content: query, sources: [] };
    setMessages((prev) => [...prev, userMsg]);

    // Streaming path
    if (streamCallback) {
      streamCallback(query, docIds, activeSession.id);
      return;
    }

    // Non-streaming fallback
    setLoading(true);
    try {
      const result  = await api.chat(activeSession.id, query, docIds);
      const asstMsg = { role: "assistant", content: result.answer, sources: result.sources };
      setMessages((prev) => [...prev, asstMsg]);

      if (messages.length === 0) {
        const autoTitle = query.slice(0, 48) + (query.length > 48 ? "…" : "");
        await renameSession(activeSession.id, autoTitle);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "error", content: e.message }]);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeSession, messages.length, renameSession]);

  return {
    sessions, activeSession, messages, loading, error,
    refreshSessions, loadSession, newSession,
    deleteSession, bulkDeleteSessions, renameSession, sendMessage,
  };
}
