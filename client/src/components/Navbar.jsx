import React from "react";
import { FileText, Plus, RotateCcw, Sparkles } from "lucide-react";

export default function Navbar({
  documents = [],
  currentView = "workspace",
  onViewChange,
  onNewUpload,
  onResetToHome,
}) {
  return (
    <header className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40 shadow-xl shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-6">
            <div
              className="flex items-center space-x-3 cursor-pointer group select-none"
              onClick={onResetToHome}
              title="Click to reset and return to Home / Upload Portal"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-all">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-white text-lg tracking-tight group-hover:text-indigo-300 transition-colors">
                    DocuIntel
                  </span>
                  <span className="bg-indigo-500/15 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-indigo-500/30 hidden sm:inline">
                    AI LICENCE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden md:block">
                  Document Intelligence Platform
                </p>
              </div>
            </div>

            {/* Separate Top-Level Navigation Menu */}
            <nav className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => onViewChange?.("workspace")}
                className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  currentView === "workspace"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Workspace</span>
              </button>

              <button
                type="button"
                onClick={() => onViewChange?.("chat")}
                className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  currentView === "chat"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>AI Chat</span>
                {documents.length > 0 && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded-full border border-indigo-500/30 hidden sm:inline">
                    {documents.length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-2.5">

            {/* Reset / Home Button */}
            <button
              type="button"
              onClick={onResetToHome}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 px-3 py-2 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
              title="Reset screen to clean upload view"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Reset / Home</span>
            </button>

            {/* Upload New Document CTA */}
            <button
              type="button"
              onClick={onNewUpload}
              className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Upload</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

