import { useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";

export function UploadModal({ onUpload, onClose }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErr("Only PDF files are supported.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErr("File must be under 50 MB.");
      return;
    }
    setErr("");
    setUploading(true);
    try {
      await onUpload(file);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UploadCloud size={20} style={{ color: "var(--text-accent)" }} />
            <h3 style={heading}>Upload PDF</h3>
          </div>
          <button style={closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div style={body}>
          <div
            style={{ ...dropzone, borderColor: dragging ? "var(--border-active)" : "var(--border-color)", background: dragging ? "var(--bg-active)" : "var(--bg-hover)" }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <FileText size={36} style={{ color: "var(--text-secondary)", marginBottom: 8 }} />
            <p style={{ margin: "0 0 4px", fontWeight: 500, color: "var(--text-primary)" }}>
              {uploading ? "Uploading…" : "Drag & drop or click to select"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>PDF up to 50 MB</p>
          </div>

          {err && <p style={errStyle}>{err}</p>}
        </div>

        <div style={actions}>
          <button style={cancelBtn} onClick={onClose} disabled={uploading}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(2px)"
};
const modal = {
  background: "var(--bg-card)", borderRadius: 24, width: 420,
  boxShadow: "var(--shadow-lg)", overflow: "hidden", border: "1px solid var(--border-color)"
};
const header = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border-color)" };
const heading = { margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text-primary)" };
const closeBtn = { background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", padding: 4, borderRadius: "50%", transition: "background 0.2s" };
const body = { padding: "24px" };
const dropzone = {
  border: "2px dashed", borderRadius: 16, padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center",
  textAlign: "center", cursor: "pointer", transition: "all 0.2s",
};
const errStyle = { color: "var(--status-err-text)", fontSize: 13, marginTop: 12, textAlign: "center" };
const actions = { display: "flex", justifyContent: "flex-end", padding: "16px 24px", borderTop: "1px solid var(--border-color)", background: "var(--bg-main)" };
const cancelBtn = {
  padding: "10px 24px", borderRadius: 24, border: "1px solid var(--border-color)",
  background: "transparent", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)", fontWeight: 600, transition: "background 0.2s"
};
