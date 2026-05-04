import { useState, useCallback } from "react";
import { api } from "../api/client";

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const refresh = useCallback(async () => {
    try {
      const docs = await api.listDocuments();
      setDocuments(docs);
    } catch (e) { setError(e.message); }
  }, []);

  const upload = useCallback(async (file) => {
    setLoading(true); setError("");
    try {
      const doc = await api.uploadPDF(file);
      await refresh();
      return doc;
    } catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  }, [refresh]);

  const remove = useCallback(async (docId) => {
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (e) { setError(e.message); }
  }, []);

  // mode: "auto" | "fast" | "js" — passed all the way to the backend
  const scrape = useCallback(async (url, crawl = false, maxPages = 10, mode = "auto") => {
    setLoading(true); setError("");
    try {
      console.log(`[useDocuments] scrape called: url=${url}, mode=${mode}, crawl=${crawl}`);
      const job = crawl
        ? await api.crawlSite(url, maxPages, mode)
        : await api.scrapeUrl(url, mode);
      await refresh();
      return job;
    } catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  }, [refresh]);

  return { documents, loading, error, refresh, upload, remove, scrape };
}
