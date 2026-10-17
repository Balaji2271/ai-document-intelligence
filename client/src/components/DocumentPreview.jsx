import React, { useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  FileCode,
  ImageIcon
} from "lucide-react";

export default function DocumentPreview({ document }) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTab, setActiveTab] = useState("preview"); // "preview" | "ocr"
  const [currentPage, setCurrentPage] = useState(1);
  const [copied, setCopied] = useState(false);

  if (!document) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-slate-400">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50 text-slate-500" />
        <p className="text-sm">No document selected for preview.</p>
      </div>
    );
  }

  const { originalName, mimeType, previewDataUrl, ocrPages, fileSize } = document;
  const isPdf = mimeType === "application/pdf";
  const totalPages = ocrPages?.length || 1;
  const currentPageText =
    ocrPages?.find((p) => p.pageNumber === currentPage)?.text || ocrPages?.[0]?.text || "";

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 20, 220));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 20, 60));
  const handleResetZoom = () => setZoomLevel(100);

  const handleCopyOcr = () => {
    navigator.clipboard.writeText(currentPageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl">
      {/* Header controls */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-900/80">
        <div className="flex items-center space-x-2">
          {isPdf ? (
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <FileText className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ImageIcon className="w-4 h-4" />
            </div>
          )}
          <span
            className="font-bold text-white text-xs sm:text-sm truncate max-w-[180px] sm:max-w-[220px]"
            title={originalName}
          >
            {originalName}
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-mono px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
            {mimeType?.split("/")[1] || "DOC"}
          </span>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center space-x-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === "preview"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Visual Document
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ocr")}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === "ocr"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            OCR Raw Text
          </button>
        </div>

        {/* Zoom & Page controls */}
        <div className="flex items-center space-x-1.5">
          {totalPages > 1 && (
            <div className="flex items-center space-x-1 text-xs text-slate-300 mr-2 border-r border-slate-800 pr-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 hover:bg-slate-800 text-slate-300 rounded disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 hover:bg-slate-800 text-slate-300 rounded disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === "preview" && !isPdf && (
            <div className="flex items-center space-x-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono text-indigo-400 min-w-[38px] text-center font-bold">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Reset Zoom to 100%"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Preview Screen */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950/60 flex items-center justify-center min-h-[420px] max-h-[650px] relative">
        {activeTab === "preview" ? (
          previewDataUrl ? (
            isPdf ? (
              <iframe
                src={`${previewDataUrl}#toolbar=0`}
                className="w-full h-full min-h-[500px] rounded-xl border border-slate-800 bg-slate-900 shadow-2xl"
                title="PDF Document Preview"
              />
            ) : (
              <div
                className="transition-transform duration-200 ease-out origin-center flex items-center justify-center max-w-full max-h-full"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              >
                <img
                  src={previewDataUrl}
                  alt={originalName}
                  className="max-h-[520px] w-auto object-contain rounded-xl shadow-2xl border border-slate-800/80 bg-slate-900"
                />
              </div>
            )
          ) : (
            <div className="text-center text-slate-500 p-8">
              <Eye className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-xs">Preview is unavailable for this file.</p>
            </div>
          )
        ) : (
          /* OCR Text Inspector Tab */
          <div className="w-full h-full bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-auto flex flex-col shadow-inner">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-2.5">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span className="text-slate-400 font-sans text-xs">
                  Page {currentPage} Raw OCR Text ({currentPageText.length} characters)
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyOcr}
                className="inline-flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white transition-all cursor-pointer shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy Raw OCR"}</span>
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-indigo-200/90 flex-1 overflow-auto selection:bg-indigo-600 selection:text-white">
              {currentPageText || "No text detected on this page."}
            </pre>
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono">
          File: {fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : "0"} MB
        </span>
        <span className="text-emerald-400 font-semibold flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>OCR Grounded • Page {currentPage} of {totalPages}</span>
        </span>
      </div>
    </div>
  );
}

