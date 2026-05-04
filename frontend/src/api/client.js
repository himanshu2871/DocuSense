import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "../context/AuthContext";

import { API_BASE_URL } from "../config";
const BASE = API_BASE_URL;
let _onUnauthorized = null;

export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

async function refreshAccessToken() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch { return false; }
}

async function req(method, path, body, isFormData = false) {
  const token = getAccessToken();
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts = {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  };

  let res = await fetch(`${BASE}${path}`, opts);

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
      res = await fetch(`${BASE}${path}`, { ...opts, headers });
    } else {
      clearTokens();
      if (_onUnauthorized) _onUnauthorized();
      throw new Error("Session expired. Please log in again.");
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

export const api = {
  // ── Documents ─────────────────────────────────────────────────────────
  listDocuments: () => req("GET", "/documents"),
  uploadPDF: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return req("POST", "/documents", fd, true);
  },
  deleteDocument: (docId) => req("DELETE", `/documents/${docId}`),

  // ── Scraping — mode is always included in body ────────────────────────
  scrapeUrl: (url, mode = "auto") =>
    req("POST", "/scrape", { url, mode }),

  crawlSite: (url, maxPages = 10, mode = "auto") =>
    req("POST", `/scrape/crawl?max_pages=${maxPages}`, { url, mode }),

  scrapeJs: (url) =>
    req("POST", "/scrape/js", { url }),

  listJobs: () => req("GET", "/scrape/jobs"),

  // ── Sessions ──────────────────────────────────────────────────────────
  createSession: (docIds = []) =>
    req("POST", `/sessions${docIds.length
      ? `?${docIds.map((d) => `doc_ids=${d}`).join("&")}`
      : ""}`),
  listSessions: () => req("GET", "/sessions"),
  getSession: (id) => req("GET", `/sessions/${id}`),
  renameSession: (id, title) =>
    req("PATCH", `/sessions/${id}/title?title=${encodeURIComponent(title)}`),
  deleteSession: (id) => req("DELETE", `/sessions/${id}`),
  bulkDeleteSessions: (ids) =>
    req("DELETE", "/sessions/bulk", { session_ids: ids }),

  // ── Chat ──────────────────────────────────────────────────────────────
  chat: (sessionId, query, docIds = []) =>
    req("POST", "/chat", { session_id: sessionId, query, doc_ids: docIds }),

  // ── Health ────────────────────────────────────────────────────────────
  health: () => fetch(`${BASE}/health`).then((r) => r.json()),
};
