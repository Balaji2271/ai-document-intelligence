import React, { useEffect } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export default function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger", // "danger" | "primary"
  icon: CustomIcon = null,
  onConfirm,
  onCancel,
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = confirmVariant === "danger";
  const IconComponent = CustomIcon || (isDanger ? Trash2 : AlertTriangle);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="glass-panel bg-slate-900/95 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden transition-all duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Ambient background glow */}
        <div
          className={`absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl pointer-events-none ${
            isDanger ? "bg-rose-600/15" : "bg-indigo-600/15"
          }`}
        />

        {/* Close icon button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-5 right-5 text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start space-x-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-lg ${
              isDanger
                ? "bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-rose-500/20"
                : "bg-indigo-500/15 border-indigo-500/30 text-indigo-400 shadow-indigo-500/20"
            }`}
          >
            <IconComponent className="w-6 h-6" />
          </div>

          <div className="flex-1 pr-4">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300/80 mt-1.5 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-lg flex items-center space-x-1.5 ${
              isDanger
                ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/25"
                : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/25"
            }`}
          >
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
