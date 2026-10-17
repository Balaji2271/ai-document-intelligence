import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  AlertCircle,
  FileSearch,
  Loader2,
  Bot,
  User,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  ChevronDown
} from "lucide-react";
import {
  askQuestion,
  deleteChatSession,
  clearAllChatSessions
} from "../services/api";
import ConfirmModal from "./ConfirmModal";

const QUICK_QUESTIONS = [
  "What is the licence expiry date?",
  "What is the licence number?",
  "What is the blood group?",
  "What vehicles is this person authorised to drive?",
  "What is the issuing authority?",
  "What is the date of birth?",
  "What is the passport number?", // Tests strict abstention / negative constraint
];

export default function DocumentChat({ document, onDocumentUpdate }) {
  const [sessions, setSessions] = useState(document?.chatSessions || []);
  const [activeSessionId, setActiveSessionId] = useState(
    document?.chatSessions && document.chatSessions.length > 0
      ? document.chatSessions[0].sessionId
      : null
  );
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Delete",
    loadingText: "Deleting...",
    confirmVariant: "danger",
    onConfirm: () => { },
  });
  const messagesEndRef = useRef(null);

  // Sync sessions when document prop updates
  useEffect(() => {
    if (document?.chatSessions) {
      setSessions(document.chatSessions);
      if (document.chatSessions.length > 0 && !activeSessionId) {
        setActiveSessionId(document.chatSessions[0].sessionId);
      }
    }
  }, [document]);

  const activeSession = sessions.find((s) => s.sessionId === activeSessionId) || null;

  // Active messages to display
  const activeMessages = activeSession
    ? activeSession.messages || []
    : [
      {
        role: "assistant",
        content: `Hello! I’m your AI document assistant. Feel free to ask questions about the selected document, and I’ll provide clear, accurate answers based exclusively on its content.`,
        evidence: [],
        isFound: true,
        timestamp: new Date(),
      },
    ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, isLoading, activeSessionId]);

  if (!document) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-slate-400">
        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50 text-slate-500" />
        <p className="text-sm">No document selected for Q&A.</p>
      </div>
    );
  }

  const handleStartNewSession = () => {
    setActiveSessionId(null);
    setInputQuery("");
    setErrorMessage(null);
  };

  const handleDeleteCurrentSession = () => {
    if (!activeSessionId) return;

    setConfirmModal({
      isOpen: true,
      title: "Delete Chat Session",
      message: "Are you sure you want to delete this chat session? Its messages and history will be permanently deleted.",
      confirmText: "Delete Session",
      loadingText: "Deleting Session...",
      confirmVariant: "danger",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const res = await deleteChatSession(document._id, activeSessionId);
          const updatedSessions = res.chatSessions || [];
          setSessions(updatedSessions);
          setActiveSessionId(updatedSessions.length > 0 ? updatedSessions[0].sessionId : null);
          if (onDocumentUpdate) {
            onDocumentUpdate({ ...document, chatSessions: updatedSessions });
          }
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          setErrorMessage(err.message || "Failed to delete session.");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleClearAllSessions = () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear All Chat Sessions",
      message: "Are you sure you want to clear ALL chat sessions for this licence? All conversation history will be permanently deleted.",
      confirmText: "Clear All",
      loadingText: "Clearing All...",
      confirmVariant: "danger",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await clearAllChatSessions(document._id);
          setSessions([]);
          setActiveSessionId(null);
          if (onDocumentUpdate) {
            onDocumentUpdate({ ...document, chatSessions: [] });
          }
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          setErrorMessage(err.message || "Failed to clear sessions.");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleSend = async (queryToSend) => {
    const query = (queryToSend || inputQuery).trim();
    if (!query || isLoading) return;

    setInputQuery("");
    setErrorMessage(null);
    setIsLoading(true);

    const userMessage = {
      role: "user",
      content: query,
      evidence: [],
      isFound: true,
      timestamp: new Date().toISOString(),
    };

    // Optimistically render user question immediately in the chat log
    const targetSessionId = activeSessionId || "temp_" + Date.now();
    setSessions((prevSessions) => {
      const existing = prevSessions.find((s) => s.sessionId === targetSessionId);
      if (existing) {
        return prevSessions.map((s) =>
          s.sessionId === targetSessionId
            ? { ...s, messages: [...(s.messages || []), userMessage] }
            : s
        );
      } else {
        return [
          {
            sessionId: targetSessionId,
            title: query.length > 35 ? query.slice(0, 35) + "..." : query,
            messages: [userMessage],
            createdAt: new Date().toISOString(),
          },
          ...prevSessions,
        ];
      }
    });

    if (!activeSessionId) {
      setActiveSessionId(targetSessionId);
    }

    try {
      const response = await askQuestion(document._id, query, activeSessionId);
      const returnedSessionId = response.sessionId;
      const returnedSessions = response.chatSessions || [];

      setSessions(returnedSessions);
      setActiveSessionId(returnedSessionId);

      if (onDocumentUpdate) {
        onDocumentUpdate({ ...document, chatSessions: returnedSessions });
      }
    } catch (err) {
      console.error("Chat error:", err);
      const errMsg =
        err.response?.data?.message || err.message || "Failed to get an answer from the document.";
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl">
      {/* Session Management Bar */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Chat Session:</span>
          </span>

          {/* Session Switcher Dropdown */}
          <div className="relative">
            <select
              value={activeSessionId || "new"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "new") {
                  handleStartNewSession();
                } else {
                  setActiveSessionId(val);
                }
              }}
              className="appearance-none bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700/80 rounded-xl pl-3 pr-8 py-1.5 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-500 max-w-[200px] sm:max-w-[280px] truncate"
            >
              <option value="new">+ Start New Session...</option>
              {sessions.map((sess) => (
                <option key={sess.sessionId} value={sess.sessionId}>
                  🧵 {sess.title} ({sess.messages ? Math.floor(sess.messages.length / 2) : 0} Q&A)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={handleStartNewSession}
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
            title="Start a fresh chat thread"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>

          {activeSessionId && (
            <button
              type="button"
              onClick={handleDeleteCurrentSession}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              title="Delete this session"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {sessions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllSessions}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Clear all sessions for this licence"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Suggested Quick Question Chips */}
      <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 overflow-x-auto scrollbar-none">
        <div className="flex items-center space-x-1.5 text-xs text-slate-400 whitespace-nowrap">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="font-semibold text-slate-300 mr-1 text-[11px]">Quick prompts:</span>
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(q)}
              disabled={isLoading}
              className="bg-slate-900/90 hover:bg-indigo-600/30 hover:text-indigo-200 text-slate-300 border border-slate-700/80 hover:border-indigo-500/50 rounded-full px-3 py-1 text-[11px] transition-all shrink-0 disabled:opacity-40 cursor-pointer shadow-xs active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
        {activeMessages.map((msg, index) => {
          const isUser = msg.role === "user";

          return (
            <div
              key={index}
              className={`flex items-start space-x-3 ${isUser ? "flex-row-reverse space-x-reverse" : ""
                }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${isUser
                    ? "bg-gradient-to-tr from-indigo-600 to-violet-600 text-white border-indigo-400/40 shadow-md shadow-indigo-600/20"
                    : msg.isError
                      ? "bg-rose-950/80 text-rose-400 border-rose-800/80"
                      : "bg-slate-800 text-indigo-400 border-slate-700 shadow-md"
                  }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`rounded-2xl px-4 py-3 text-xs sm:text-sm max-w-[85%] shadow-md ${isUser
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium shadow-indigo-600/20"
                    : msg.isError
                      ? "bg-rose-950/50 text-rose-200 border border-rose-800/80"
                      : "glass-card text-slate-200 border border-slate-800/90"
                  }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {isUser ? "You" : "DocuIntel AI Assistant"}
                  </span>
                  {msg.timestamp && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {/* Strict Grounding Abstention Pill */}
                {!isUser && msg.isFound === false && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center space-x-1.5 text-amber-300 text-[11px] font-semibold bg-amber-950/40 p-2 rounded-lg border border-amber-800/60">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>Strict Grounding: This information is not present in the document.</span>
                  </div>
                )}

                {/* Evidence Source Quotations */}
                {msg.evidence && msg.evidence.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                    <div className="flex items-center space-x-1 text-indigo-400 font-bold">
                      <FileSearch className="w-3 h-3 text-indigo-400" />
                      <span>Source Grounding Citations:</span>
                    </div>
                    {msg.evidence.map((ev, eIdx) => (
                      <div
                        key={eIdx}
                        className="bg-slate-950/80 p-2 rounded-lg border border-indigo-900/50 text-slate-300 font-mono text-[10px]"
                      >
                        <span className="font-bold text-indigo-400 font-sans mr-1">
                          Page {ev.page}:
                        </span>
                        <span className="italic text-indigo-200/90">"{ev.quote}"</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center space-x-2.5 text-xs text-indigo-300 p-3 glass-card rounded-xl border border-indigo-500/20 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Analyzing licence OCR text & formulating grounded answer...</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={
            activeSession
              ? `Ask question in session "${activeSession.title}"...`
              : "Ask question to start a new chat session..."
          }
          disabled={isLoading}
          className="flex-1 bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isLoading}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white p-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95"
          title="Send Question"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

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

