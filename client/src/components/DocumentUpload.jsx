import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Layers,
  Trash2,
  FileUp
} from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

export default function DocumentUpload({
  onUploadComplete,
  isUploading,
  uploadProgress,
  recentDocuments = [],
  onSelectDocument,
  onDeleteDocument,
  onDeleteAllDocuments,
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingStage, setProcessingStage] = useState("");
  const fileInputRef = useRef(null);

  const validateAndSetFile = (file) => {
    setErrorMessage("");

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage(
        `Unsupported file type (${file.type || "unknown"}). Only PDF, PNG, and JPEG documents are supported.`
      );
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Only files up to 5MB are allowed.`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || isUploading) return;

    try {
      setProcessingStage("Extracting document text with OCR & Cloud Parser...");
      await onUploadComplete(selectedFile);
    } catch (err) {
      setErrorMessage(err.message || "Failed to process document.");
    } finally {
      setProcessingStage("");
    }
  };

  return (
    <div className="max-w-5xl mx-auto my-6 px-4 sm:px-6">
      {/* Hero Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
          AI Document Intelligence
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mt-3 leading-relaxed">
          Upload any driving licence in PDF or image format. The pipeline automatically extracts text, populates structured fields, and enables grounded conversational AI.
        </p>
      </div>

      {/* Main Glassmorphic Upload Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden mb-10">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 ${
              dragActive
                ? "border-indigo-400 bg-indigo-500/15 scale-[1.01] shadow-2xl shadow-indigo-500/20"
                : selectedFile
                ? "border-emerald-500/80 bg-emerald-950/20 shadow-lg shadow-emerald-500/10"
                : "border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/60 hover:bg-slate-900/90"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleChange}
              className="hidden"
              disabled={isUploading}
            />

            <div className="flex flex-col items-center justify-center space-y-4">
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all ${
                  selectedFile
                    ? "bg-emerald-500/20 text-emerald-400 shadow-xl shadow-emerald-500/20 border border-emerald-500/30"
                    : "bg-indigo-500/15 text-indigo-400 shadow-xl shadow-indigo-500/20 border border-indigo-500/30"
                }`}
              >
                {selectedFile ? (
                  <FileText className="w-8 h-8 sm:w-10 sm:h-10 animate-bounce" />
                ) : (
                  <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10" />
                )}
              </div>

              {selectedFile ? (
                <div>
                  <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full mb-1 border border-emerald-800/60">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>File Ready for Processing</span>
                  </div>
                  <p className="font-bold text-white text-lg sm:text-xl">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || "Document"}
                  </p>
                  <span className="inline-block mt-2 text-xs text-indigo-400 font-semibold hover:text-indigo-300 underline">
                    Click to browse another file
                  </span>
                </div>
              ) : (
                <div>
                  <p className="text-white font-bold text-base sm:text-lg">
                    Drag and drop your licence document here, or{" "}
                    <span className="text-indigo-400 underline hover:text-indigo-300">browse files</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-2 font-medium">
                    Supports Indian & International Driving Licences • PDF, PNG, JPG, JPEG
                  </p>
                  <div className="mt-2.5 inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-300 bg-amber-950/50 border border-amber-800/70 px-3 py-1 rounded-full">
                    <span>⚠️ Only files up to 5MB are allowed</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-4 p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs sm:text-sm flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Action Row: File Status & Submit Button */}
          <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 flex items-center space-x-2">
              <FileUp className="w-4 h-4 text-indigo-400" />
              <span>
                {selectedFile
                  ? `Ready: ${selectedFile.name}`
                  : "Select or drop any licence document to begin"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleUploadSubmit}
              disabled={!selectedFile || isUploading}
              className={`w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-8 py-3.5 rounded-xl text-sm font-bold transition-all shadow-xl ${
                !selectedFile || isUploading
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none border border-slate-700/50"
                  : "bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/30 hover:shadow-indigo-600/50 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Processing Document...</span>
                </>
              ) : (
                <>
                  <span>Process & Extract Information</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Processing Progress Feedback */}
          {isUploading && (
            <div className="mt-6 p-4 bg-slate-900/90 border border-indigo-500/30 rounded-2xl shadow-inner">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-300 mb-2">
                <span className="flex items-center space-x-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>{processingStage || "Running Document Intelligence Pipeline..."}</span>
                </span>
                <span className="font-mono text-indigo-400">{uploadProgress || 65}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress || 65}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Previously Processed Licences Section with per-card & bulk delete */}
      {recentDocuments && recentDocuments.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Previously Processed Licences ({recentDocuments.length})
              </h2>
            </div>
            <div className="flex items-center space-x-3">
              {onDeleteAllDocuments && (
                <button
                  type="button"
                  onClick={onDeleteAllDocuments}
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/60 hover:border-rose-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                  title="Delete all documents"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete All Documents</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {recentDocuments.map((doc) => {
              const name = doc.extractedData?.fullName?.value || "Extracted Licence";
              const dlNo = doc.extractedData?.licenceNumber?.value || doc.originalName;
              const dateStr = new Date(doc.createdAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const isReviewed = doc.reviewStatus === "reviewed";

              return (
                <div
                  key={doc._id}
                  onClick={() => onSelectDocument?.(doc._id)}
                  className="glass-card hover:bg-slate-800/80 p-4 rounded-2xl cursor-pointer transition-all border border-slate-800 hover:border-indigo-500/50 group shadow-lg hover:shadow-indigo-500/10 relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isReviewed
                            ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/60"
                            : "bg-amber-950/50 text-amber-300 border-amber-800/60"
                        }`}
                      >
                        {isReviewed ? "Reviewed" : "Auto-Extracted"}
                      </span>
                      {onDeleteDocument && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDocument(doc._id);
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                          title="Delete this document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-bold text-white text-sm truncate group-hover:text-indigo-300 transition-colors">
                      {name}
                    </h3>
                    <p className="text-xs font-mono text-indigo-400 mt-0.5 truncate">
                      {dlNo}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>{dateStr}</span>
                    </span>
                    <span className="text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center space-x-0.5">
                      <span>Open Workspace</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


