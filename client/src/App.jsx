import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import DocumentUpload from "./components/DocumentUpload";
import DocumentPreview from "./components/DocumentPreview";
import LicenceForm from "./components/LicenceForm";
import DocumentChat from "./components/DocumentChat";
import ConfirmModal from "./components/ConfirmModal";
import {
  checkHealth,
  getDocuments,
  getDocumentById,
  uploadDocument,
  updateDocument,
  deleteDocument,
  deleteAllDocuments,
} from "./services/api";
import {
  AlertCircle,
  FileText,
  CheckCircle2,
  MessageSquare,
  Shield,
  Trash2,
  ArrowLeft,
  Sparkles,
  Loader2,
  Plus,
  ChevronDown,
  FolderOpen
} from "lucide-react";

export default function App() {
  const [systemHealth, setSystemHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDocument, setActiveDocument] = useState(null);
  const [currentView, setCurrentView] = useState("workspace"); // "workspace" | "chat"
  const [isBrowsingChatDocs, setIsBrowsingChatDocs] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(true);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Delete",
    loadingText: "Deleting...",
    confirmVariant: "danger",
    onConfirm: () => {},
  });

  // Fetch system health and document history on mount (Clean Slate: does NOT auto-lock to old doc)
  useEffect(() => {
    loadHealthAndDocs();
  }, []);

  const showToast = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadHealthAndDocs = async () => {
    try {
      const healthData = await checkHealth().catch(() => null);
      setSystemHealth(healthData);

      const docsRes = await getDocuments().catch(() => ({ data: [] }));
      const docsList = docsRes.data || [];
      setDocuments(docsList);
    } catch (err) {
      console.error("Initial load error:", err);
    }
  };

  const loadFullDocument = async (id, targetView = null) => {
    if (!id) return;
    setIsLoadingDoc(true);
    try {
      const res = await getDocumentById(id);
      if (res.data) {
        setActiveDocument(res.data);
        setShowUploadModal(false);
        if (targetView) setCurrentView(targetView);
        showToast(`Loaded "${res.data.originalName}" into ${targetView === "chat" ? "AI Chat" : "Workspace"}.`, "info");
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || "Failed to load document.", "error");
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleResetToHome = () => {
    setActiveDocument(null);
    setShowUploadModal(true);
    setCurrentView("workspace");
    showToast("Workspace resetted to upload portal.", "info");
  };

  const handleUpload = async (file) => {
    setIsUploading(true);
    setUploadProgress(20);

    try {
      const res = await uploadDocument(file, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 70) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      setUploadProgress(100);

      if (res.data) {
        setActiveDocument(res.data);
        setShowUploadModal(false);
        showToast(res.message || "Document processed successfully!", "success");

        // Refresh docs list
        const updatedDocs = await getDocuments();
        setDocuments(updatedDocs.data || []);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Upload and processing failed.";
      showToast(msg, "error");
      throw new Error(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSaveReviewedData = async (docId, reviewedPayload) => {
    setIsSaving(true);
    try {
      const res = await updateDocument(docId, reviewedPayload, "reviewed");
      if (res.data) {
        setActiveDocument(res.data);
        showToast("Reviewed licence fields saved successfully.", "success");

        // Update list
        setDocuments((prev) =>
          prev.map((d) => (d._id === docId ? { ...d, reviewStatus: "reviewed" } : d))
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Save failed.";
      showToast(msg, "error");
      throw new Error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = (id) => {
    const docToDelete = documents.find((d) => d._id === id);
    const docName = docToDelete?.originalName ? `"${docToDelete.originalName}"` : "this document";

    setConfirmModal({
      isOpen: true,
      title: "Delete Document",
      message: `Are you sure you want to delete ${docName}? This will permanently remove the document, its extracted data, and chat history.`,
      confirmText: "Delete Document",
      loadingText: "Deleting Document...",
      confirmVariant: "danger",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await deleteDocument(id);
          showToast("Document deleted successfully.", "info");

          const remainingDocs = documents.filter((d) => d._id !== id);
          setDocuments(remainingDocs);

          if (activeDocument?._id === id) {
            if (remainingDocs.length > 0) {
              loadFullDocument(remainingDocs[0]._id, currentView);
            } else {
              handleResetToHome();
            }
          }
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          showToast(err.response?.data?.message || err.message, "error");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleDeleteAllDocuments = () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete All Documents",
      message: `Are you sure you want to delete all ${documents.length} documents? This action will permanently wipe your document history and cannot be undone.`,
      confirmText: "Delete All Documents",
      loadingText: "Deleting All...",
      confirmVariant: "danger",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await deleteAllDocuments();
          showToast("All documents deleted successfully.", "info");
          setDocuments([]);
          setActiveDocument(null);
          setShowUploadModal(true);
          setCurrentView("workspace");
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          showToast(err.response?.data?.message || err.message, "error");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white relative">
      {/* Subtle Background Glow Elements */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation Header with Workspace and AI Chat Menu */}
      <Navbar
        systemHealth={systemHealth}
        documents={documents}
        currentView={currentView}
        onViewChange={setCurrentView}
        onNewUpload={() => {
          setActiveDocument(null);
          setShowUploadModal(true);
          setCurrentView("workspace");
        }}
        onResetToHome={handleResetToHome}
      />

      {/* Floating Notifications */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs sm:text-sm font-semibold flex items-center space-x-2.5 backdrop-blur-xl ${
              notification.type === "success"
                ? "bg-emerald-950/90 text-emerald-200 border-emerald-700/80 shadow-emerald-900/30"
                : notification.type === "error"
                ? "bg-rose-950/90 text-rose-200 border-rose-700/80 shadow-rose-900/30"
                : "bg-slate-900/90 text-slate-200 border-slate-700/80 shadow-black/40"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : notification.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col relative z-10">
        {/* VIEW 1: WORKSPACE (Upload / Document Preview / Extracted Form) */}
        {currentView === "workspace" && (
          !activeDocument || showUploadModal ? (
            <div>
              {activeDocument && (
                <div className="mb-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="inline-flex items-center space-x-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-xl border border-slate-800 hover:border-slate-700 shadow-md cursor-pointer transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 text-indigo-400" />
                    <span>Return to Active Document ({activeDocument.originalName})</span>
                  </button>
                </div>
              )}
              <DocumentUpload
                onUploadComplete={handleUpload}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                recentDocuments={documents}
                onSelectDocument={(id) => loadFullDocument(id, "workspace")}
                onDeleteDocument={handleDeleteDocument}
                onDeleteAllDocuments={handleDeleteAllDocuments}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-4">
              {/* Active Document Header Bar */}
              <div className="glass-panel rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md shadow-indigo-500/10">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
                        {activeDocument.originalName}
                      </h2>
                      {activeDocument.extractedData?.licenceNumber?.value && (
                        <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/80 hidden sm:inline">
                          {activeDocument.extractedData.licenceNumber.value}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Uploaded on {new Date(activeDocument.createdAt).toLocaleDateString()} at{" "}
                      {new Date(activeDocument.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{" "}
                      {(activeDocument.fileSize / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                {/* Quick Link to AI Chat & Delete Button */}
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setCurrentView("chat")}
                    className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl font-bold text-xs bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Open interactive AI Grounded Q&A for this licence"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Open AI Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteDocument(activeDocument._id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900 rounded-xl transition-all cursor-pointer"
                    title="Delete Document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Loading Indicator when switching documents */}
              {isLoadingDoc && (
                <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 text-xs flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Switching document context...</span>
                </div>
              )}

              {/* Split Workspace: Document Preview on Left, Form on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
                <div className="lg:col-span-6 h-[720px] flex flex-col">
                  <DocumentPreview
                    key={`preview-${activeDocument._id}`}
                    document={activeDocument}
                  />
                </div>

                <div className="lg:col-span-6 h-[720px] flex flex-col">
                  <LicenceForm
                    key={`form-${activeDocument._id}`}
                    document={activeDocument}
                    onSave={handleSaveReviewedData}
                    isSaving={isSaving}
                    onNewUpload={() => {
                      setActiveDocument(null);
                      setShowUploadModal(true);
                      setCurrentView("workspace");
                    }}
                  />
                </div>
              </div>
            </div>
          )
        )}

        {/* VIEW 2: DEDICATED AI CHAT MENU */}
        {currentView === "chat" && (
          <div className="flex-1 flex flex-col space-y-4">
            {/* Document Selection Ribbon for AI Chat */}
            <div className="glass-panel rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <FolderOpen className="w-4 h-4 text-indigo-400" />
                  <span>
                    {documents && documents.length > 0
                      ? "Select Document to Chat:"
                      : "AI Document Chat"}
                  </span>
                </span>

                {/* Quick Dropdown for Immediate Selection */}
                {documents && documents.length > 0 && (
                  <div className="relative">
                    <select
                      value={activeDocument?._id || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "browse") {
                          setIsBrowsingChatDocs(true);
                        } else if (val) {
                          setIsBrowsingChatDocs(false);
                          loadFullDocument(val, "chat");
                        }
                      }}
                      className="appearance-none bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700/80 rounded-xl pl-3 pr-8 py-1.5 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-500 max-w-[210px] sm:max-w-[320px] truncate"
                    >
                      <option value="" disabled>Choose an uploaded licence...</option>
                      {documents.map((doc) => (
                        <option key={doc._id} value={doc._id}>
                          {doc.extractedData?.licenceNumber?.value ? `${doc.extractedData.licenceNumber.value} - ` : ""}
                          {doc.originalName} ({new Date(doc.createdAt).toLocaleDateString()})
                        </option>
                      ))}
                      <option value="browse">📋 Browse Document Shelf Grid...</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Action Buttons in Document Ribbon */}
              <div className="flex items-center space-x-2">
                {documents && documents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsBrowsingChatDocs(!isBrowsingChatDocs)}
                    className="inline-flex items-center space-x-1.5 text-xs text-indigo-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-indigo-500/30 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Toggle grid view of all uploaded documents"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isBrowsingChatDocs ? "Close Shelf" : "Browse All Documents"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveDocument(null);
                    setShowUploadModal(true);
                    setCurrentView("workspace");
                  }}
                  className="inline-flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/80 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Upload a new driving licence"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Upload New</span>
                </button>
              </div>
            </div>

            {/* Document Selection Grid (when user chooses to browse or if no document is active) */}
            {(isBrowsingChatDocs || !activeDocument) ? (
              <div className="glass-panel rounded-3xl p-6 sm:p-10 shadow-2xl relative">
                {documents && documents.length > 0 ? (
                  <>
                    <div className="text-center max-w-2xl mx-auto mb-8">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white mx-auto mb-3 shadow-xl shadow-indigo-600/30">
                        <MessageSquare className="w-7 h-7" />
                      </div>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                        Select a Document to Chat
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        Choose any driving licence below to start grounded AI Q&A.
                      </p>
                      {activeDocument && isBrowsingChatDocs && (
                        <button
                          type="button"
                          onClick={() => setIsBrowsingChatDocs(false)}
                          className="mt-3 inline-flex items-center space-x-1 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/20 px-3 py-1 rounded-lg border border-indigo-500/40 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Return to Active Chat ({activeDocument.originalName})</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {documents.map((doc) => {
                        const isSelected = activeDocument?._id === doc._id;
                        return (
                          <div
                            key={doc._id}
                            onClick={() => {
                              setIsBrowsingChatDocs(false);
                              loadFullDocument(doc._id, "chat");
                            }}
                            className={`p-5 rounded-2xl cursor-pointer text-left transition-all group relative border ${
                              isSelected
                                ? "bg-indigo-950/40 border-indigo-500 shadow-xl shadow-indigo-600/20 ring-1 ring-indigo-500"
                                : "glass-card hover:bg-slate-800/90 border-slate-800 hover:border-indigo-500/60 shadow-md"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/80 truncate max-w-[180px]">
                                {doc.extractedData?.licenceNumber?.value || "Licence"}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/40 flex items-center space-x-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Active</span>
                                </span>
                              )}
                            </div>

                            <h3 className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors truncate">
                              {doc.extractedData?.fullName?.value || doc.originalName}
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {doc.originalName}
                            </p>

                            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                              <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                              <span className="text-indigo-400 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center space-x-1">
                                <span>Chat Now</span>
                                <span>→</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center max-w-lg mx-auto py-12">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-indigo-600/30">
                      <MessageSquare className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                      No Documents Uploaded Yet
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed max-w-md mx-auto">
                      Upload a driving licence to start asking grounded questions, verifying validity dates, and extracting key details with AI.
                    </p>
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUploadModal(true);
                          setCurrentView("workspace");
                        }}
                        className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 cursor-pointer transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Upload a Driving Licence</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Split Chat Workspace: Visual Document on Left, Grounded Q&A on Right */
              <>
                {/* Chat Header Bar */}
                <div className="glass-panel rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
                          AI Document Assistant
                        </h2>
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/80">
                          {activeDocument.extractedData?.licenceNumber?.value || activeDocument.originalName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Chatting with "{activeDocument.originalName}" • Grounded strictly in licence text
                      </p>
                    </div>
                  </div>

                  {/* Actions in Chat Header */}
                  <div className="flex items-center space-x-2.5">
                    <button
                      type="button"
                      onClick={() => setIsBrowsingChatDocs(true)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 transition-all cursor-pointer shadow-xs active:scale-95"
                      title="Switch to another uploaded licence"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Select Another Doc</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentView("workspace")}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer shadow-xs"
                      title="Return to Structured Form & Edit View"
                    >
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Back to Form</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(activeDocument._id)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900 rounded-xl transition-all cursor-pointer"
                      title="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Split Chat Workspace: Visual Document on Left, Grounded Q&A on Right */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
                  <div className="lg:col-span-6 h-[720px] flex flex-col">
                    <DocumentPreview
                      key={`chat-preview-${activeDocument._id}`}
                      document={activeDocument}
                    />
                  </div>

                  <div className="lg:col-span-6 h-[720px] flex flex-col">
                    <DocumentChat
                      key={`chat-window-${activeDocument._id}`}
                      document={activeDocument}
                      onDocumentUpdate={(updatedDoc) => {
                        setActiveDocument(updatedDoc);
                        setDocuments((prev) =>
                          prev.map((d) => (d._id === updatedDoc._id ? updatedDoc : d))
                        );
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 bg-slate-950/60 backdrop-blur-md py-4 text-center text-xs text-slate-500 relative z-10">
        DocuIntel • AI Document Intelligence Platform
      </footer>

      {/* In-built Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        loadingText={confirmModal.loadingText || "Deleting..."}
        confirmVariant={confirmModal.confirmVariant}
        isLoading={isDeleting}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => {
          if (!isDeleting) setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
}


