"use client";

import { useState, useRef, useCallback } from "react";
import "./globals.css";

const CROP_OPTIONS = [
  { value: "未知作物", label: "自動辨識" },
  { value: "苦瓜", label: "苦瓜" },
  { value: "番茄", label: "番茄" },
  { value: "水稻", label: "水稻" },
  { value: "辣椒", label: "辣椒" },
  { value: "葉菜類", label: "葉菜類" },
  { value: "瓜類", label: "瓜類" },
  { value: "果樹", label: "果樹" },
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropType, setCropType] = useState("未知作物");
  const [userNote, setUserNote] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback(
    (file: File, maxWidth = 1280, quality = 0.8): Promise<File> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ratio = Math.min(1, maxWidth / Math.max(img.width, img.height));
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              resolve(new File([blob!], file.name, { type: "image/jpeg" }));
            },
            "image/jpeg",
            quality
          );
        };
        img.src = URL.createObjectURL(file);
      }),
    []
  );

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setError("檔案太大，最大 20MB");
      return;
    }
    setError(null);
    setResult(null);

    const compressed = await compressImage(file);
    setSelectedFile(compressed);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(compressed);
  }, [compressImage]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const analyze = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("crop_type", cropType);
    if (userNote.trim()) formData.append("user_note", userNote.trim());

    try {
      const resp = await fetch("/api/diagnosis", {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setResult(data.result);
      setMeta(`模型：${data.model} | ${data.tokens} tokens | ${(data.latency_ms / 1000).toFixed(1)}s`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "辨識失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>農知 NongZhi</h1>
      <p style={styles.subtitle}>
        AI 作物病蟲害辨識 — 拍照上傳，即時分析
      </p>

      <div
        style={{
          ...styles.uploadArea,
          ...(dragOver ? styles.uploadAreaHover : {}),
          ...(preview ? styles.uploadAreaHasImage : {}),
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {preview ? (
          <img src={preview} alt="Preview" style={styles.preview} />
        ) : (
          <>
            <div style={styles.uploadIcon}>📸</div>
            <div style={styles.uploadText}>點擊上傳或拖放照片</div>
            <div style={styles.uploadHint}>支援 JPG、PNG、WebP（最大 10MB）</div>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
      />

      <div style={styles.cropSelect}>
        <label style={styles.cropLabel}>作物類型：</label>
        <select
          value={cropType}
          onChange={(e) => setCropType(e.target.value)}
          style={styles.select}
        >
          {CROP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.noteSection}>
        <label style={styles.cropLabel}>補充說明（選填）：</label>
        <textarea
          value={userNote}
          onChange={(e) => setUserNote(e.target.value)}
          placeholder="例：葉片背面有白色小蟲、最近連續下雨、種了兩個月..."
          style={styles.textarea}
          rows={3}
        />
      </div>

      <button
        style={{
          ...styles.btn,
          ...(loading || !selectedFile ? styles.btnDisabled : {}),
        }}
        onClick={analyze}
        disabled={loading || !selectedFile}
      >
        {loading ? "AI 分析中..." : "開始辨識"}
      </button>

      {loading && (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <div>正在分析照片，約需 10 秒...</div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {result && (
        <div style={styles.resultCard}>
          <h2 style={styles.resultTitle}>辨識結果</h2>
          <div style={styles.resultContent}>{result}</div>
          {meta && <div style={styles.resultMeta}>{meta}</div>}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "24px 16px",
  },
  title: {
    fontSize: 28,
    textAlign: "center",
    marginBottom: 4,
    color: "#3a5a20",
  },
  subtitle: {
    textAlign: "center",
    color: "#6b7c5a",
    marginBottom: 32,
    fontSize: 14,
  },
  uploadArea: {
    border: "3px dashed #9ab87c",
    borderRadius: 16,
    padding: "48px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    background: "#fff",
  },
  uploadAreaHover: {
    borderColor: "#5a8a30",
    background: "#f8faf4",
  },
  uploadAreaHasImage: {
    padding: 16,
  },
  uploadIcon: { fontSize: 48, marginBottom: 12 },
  uploadText: { color: "#6b7c5a", fontSize: 16 },
  uploadHint: { color: "#9aa88c", fontSize: 13, marginTop: 8 },
  preview: {
    maxWidth: "100%",
    maxHeight: 400,
    borderRadius: 12,
  },
  cropSelect: {
    marginTop: 20,
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cropLabel: { fontWeight: 600, color: "#3a5a20", fontSize: 15 },
  noteSection: {
    marginTop: 16,
  },
  textarea: {
    width: "100%",
    marginTop: 8,
    padding: "10px 14px",
    border: "2px solid #9ab87c",
    borderRadius: 10,
    fontSize: 15,
    fontFamily: "inherit",
    color: "#2d3a1e",
    background: "#fff",
    resize: "vertical" as const,
    outline: "none",
  },
  select: {
    padding: "8px 16px",
    border: "2px solid #9ab87c",
    borderRadius: 8,
    fontSize: 15,
    background: "#fff",
    color: "#2d3a1e",
  },
  btn: {
    display: "block",
    width: "100%",
    padding: 14,
    marginTop: 20,
    background: "#4a7a25",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 17,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDisabled: {
    background: "#b0c4a0",
    cursor: "not-allowed",
  },
  loading: {
    textAlign: "center",
    padding: 32,
    color: "#6b7c5a",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "4px solid #e8f0d8",
    borderTopColor: "#4a7a25",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto 16px",
  },
  error: {
    marginTop: 16,
    padding: 16,
    background: "#fef0f0",
    border: "1px solid #f0c0c0",
    borderRadius: 12,
    color: "#8a2020",
  },
  resultCard: {
    marginTop: 24,
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  resultTitle: {
    color: "#3a5a20",
    fontSize: 20,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "2px solid #e8f0d8",
  },
  resultContent: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.8,
    fontSize: 15,
  },
  resultMeta: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid #e8f0d8",
    color: "#8a9a7a",
    fontSize: 13,
  },
};
