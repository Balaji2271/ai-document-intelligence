import React, { useState, useEffect } from "react";
import {
  User,
  CreditCard,
  Calendar,
  MapPin,
  Building2,
  Car,
  HeartPulse,
  Save,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  FileSearch,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Edit3,
  UploadCloud,
  Loader2
} from "lucide-react";

// Categorized structure for clear human-in-the-loop review
const FIELD_CATEGORIES = [
  {
    title: "Personal & Licence Identity",
    icon: User,
    fields: [
      { key: "fullName", label: "Full Name", placeholder: "e.g. ROHAN ANIL DESHMUKH", type: "text", icon: User },
      { key: "licenceNumber", label: "Licence Number", placeholder: "e.g. MH12 20190001234", type: "text", icon: CreditCard },
      { key: "dateOfBirth", label: "Date of Birth", placeholder: "YYYY-MM-DD", type: "date", icon: Calendar },
      { key: "bloodGroup", label: "Blood Group", placeholder: "e.g. A+, B+, O+", type: "text", icon: HeartPulse },
    ],
  },
  {
    title: "Validity & Timeline",
    icon: Calendar,
    fields: [
      { key: "dateOfIssue", label: "Date of Issue", placeholder: "YYYY-MM-DD", type: "date", icon: Calendar },
      { key: "dateOfExpiry", label: "Date of Expiry (NT / TR)", placeholder: "YYYY-MM-DD", type: "date", icon: Calendar },
    ],
  },
  {
    title: "Jurisdiction & Residence",
    icon: MapPin,
    fields: [
      { key: "address", label: "Permanent / Present Address", placeholder: "e.g. Flat No. 302, Karve Nagar, Pune", type: "textarea", icon: MapPin },
      { key: "issuingAuthority", label: "Issuing Authority / RTO", placeholder: "e.g. RTO Pune, Maharashtra", type: "text", icon: Building2 },
    ],
  },
  {
    title: "Authorisations & Other Info",
    icon: Car,
    fields: [
      { key: "vehicleClasses", label: "Authorised Vehicle Classes (COV)", placeholder: "e.g. LMV, MCWG", type: "text", icon: Car },
      { key: "otherInfo", label: "Relation / Other Details", placeholder: "e.g. S/D/W of RAJESH SHARMA", type: "text", icon: User },
    ],
  },
];

const ALL_FIELD_KEYS = FIELD_CATEGORIES.flatMap((c) => c.fields);

const MONTH_MAP = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

const toInputDateFormat = (val) => {
  if (!val || typeof val !== "string") return "";
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD-MMM-YYYY or DD MMM YYYY (e.g. 25-MAR-1992, 14-OCT-2015)
  const monthNameMatch = trimmed.match(/^(\d{1,2})[-/\s.]([a-zA-Z]{3,9})[-/\s.](\d{4})$/);
  if (monthNameMatch) {
    const [, d, monStr, y] = monthNameMatch;
    const m = MONTH_MAP[monStr.toLowerCase().slice(0, 3)];
    if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ukMatch) {
    const [, d, m, y] = ukMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
};

export default function LicenceForm({ document, onSave, isSaving, onNewUpload }) {
  const [formData, setFormData] = useState({});
  const [isEditedMap, setIsEditedMap] = useState({});
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [isEditing, setIsEditing] = useState(document?.reviewStatus !== "reviewed");

  // Initialize form state from document data
  useEffect(() => {
    if (!document) return;

    const initialValues = {};
    const editedFlags = {};
    const sourceData = document.reviewedData || document.extractedData || {};

    ALL_FIELD_KEYS.forEach(({ key }) => {
      const fieldObj = sourceData[key];
      let val = "";

      if (fieldObj) {
        if (typeof fieldObj === "object" && fieldObj !== null && "value" in fieldObj) {
          val = fieldObj.value !== null && fieldObj.value !== undefined ? String(fieldObj.value) : "";
          if (Array.isArray(fieldObj.value)) val = fieldObj.value.join(", ");
          editedFlags[key] = Boolean(fieldObj.isEdited);
        } else if (typeof fieldObj === "string" || typeof fieldObj === "number") {
          val = String(fieldObj);
        }
      }

      initialValues[key] = val;
    });

    setFormData(initialValues);
    setIsEditedMap(editedFlags);
    setIsEditing(document.reviewStatus !== "reviewed");
    setStatusMessage(null);
  }, [document]);

  const handleFieldChange = (key, rawValue) => {
    let value = rawValue;
    const isDateField = key === "dateOfBirth" || key === "dateOfIssue" || key === "dateOfExpiry";

    // Strictly disallow alphabets and non-date characters in date fields
    if (isDateField && typeof value === "string") {
      value = value.replace(/[^0-9\-/.]/g, "");
    }

    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsEditedMap((prev) => ({ ...prev, [key]: true }));
    setStatusMessage(null);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setStatusMessage(null);
  };

  const handleCancelEdit = () => {
    const sourceData = document.reviewedData || document.extractedData || {};
    const resetValues = {};
    const resetEdited = {};
    ALL_FIELD_KEYS.forEach(({ key }) => {
      const fieldObj = sourceData[key];
      let val = "";
      if (fieldObj) {
        if (typeof fieldObj === "object" && fieldObj !== null && "value" in fieldObj) {
          val = fieldObj.value !== null && fieldObj.value !== undefined ? String(fieldObj.value) : "";
          if (Array.isArray(fieldObj.value)) val = fieldObj.value.join(", ");
          resetEdited[key] = Boolean(fieldObj.isEdited);
        } else if (typeof fieldObj === "string" || typeof fieldObj === "number") {
          val = String(fieldObj);
        }
      }
      resetValues[key] = val;
    });
    setFormData(resetValues);
    setIsEditedMap(resetEdited);
    setIsEditing(false);
    setStatusMessage(null);
  };

  const handleReset = () => {
    if (!document?.extractedData) return;

    const resetValues = {};
    const resetEdited = {};

    ALL_FIELD_KEYS.forEach(({ key }) => {
      const fieldObj = document.extractedData[key];
      let val = "";
      if (fieldObj && fieldObj.value !== null && fieldObj.value !== undefined) {
        val = Array.isArray(fieldObj.value) ? fieldObj.value.join(", ") : String(fieldObj.value);
      }
      resetValues[key] = val;
      resetEdited[key] = false;
    });

    setFormData(resetValues);
    setIsEditedMap(resetEdited);
    setStatusMessage({ type: "info", text: "Reset form back to original extracted AI values." });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!document?._id || isSaving) return;

    // Validate that licence number is present
    if (!formData.licenceNumber || formData.licenceNumber.trim() === "") {
      setStatusMessage({
        type: "error",
        text: "Uploaded document is not a driving license. Driving licence number is required.",
      });
      return;
    }

    // Validate that date fields contain no alphabets
    for (const dk of ["dateOfBirth", "dateOfIssue", "dateOfExpiry"]) {
      const val = formData[dk]?.trim();
      if (val && /[a-zA-Z]/.test(val)) {
        const fieldLabel =
          dk === "dateOfBirth"
            ? "Date of Birth"
            : dk === "dateOfIssue"
            ? "Date of Issue"
            : "Date of Expiry";
        setStatusMessage({
          type: "error",
          text: `Invalid characters in ${fieldLabel}. Alphabets are not allowed in date fields.`,
        });
        return;
      }
    }


    const reviewedPayload = {};
    ALL_FIELD_KEYS.forEach(({ key }) => {
      const orig = document.extractedData?.[key] || {};
      const currentValue = formData[key]?.trim() || null;
      const isEdited = Boolean(isEditedMap[key]);

      reviewedPayload[key] = {
        value: currentValue,
        sourceText: orig.sourceText || null,
        page: orig.page || 1,
        confidence: isEdited ? 100 : orig.confidence || null,
        isEdited,
      };
    });

    try {
      await onSave(document._id, reviewedPayload);
      setIsEditing(false); // Disable fields and switch to read-only after saving
      setStatusMessage({ type: "success", text: "Verified licence data saved successfully." });
    } catch (err) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save reviewed fields." });
    }
  };

  const toggleEvidence = (key) => {
    setExpandedEvidence((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!document) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-slate-400">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50 text-slate-500" />
        <p className="text-sm">No document loaded for structured form review.</p>
      </div>
    );
  }

  const isReviewed = document.reviewStatus === "reviewed";
  const userEditCount = Object.values(isEditedMap).filter(Boolean).length;

  return (
    <div className="glass-panel rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl">
      {/* Header bar */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/80">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white text-xs sm:text-sm whitespace-nowrap">
                Structured Licence Form
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border whitespace-nowrap shrink-0 ${
                  !isEditing
                    ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/80"
                    : "bg-amber-950/60 text-amber-300 border-amber-800/80"
                }`}
              >
                {!isEditing ? "✓ Saved" : "Editing"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {userEditCount > 0 ? `${userEditCount} field(s) edited by user` : "Auto-extracted with OCR + LLM"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {!isEditing ? (
            /* Saved / Read-Only Mode: Show "Edit Form" and "Upload New" */
            <>
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex items-center justify-center space-x-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-indigo-500/60 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap h-8.5"
                title="Unlock fields to edit licence data"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Edit Form</span>
              </button>

              {onNewUpload && (
                <button
                  type="button"
                  onClick={onNewUpload}
                  className="inline-flex items-center justify-center space-x-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-3 py-1.5 rounded-lg transition-all shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95 whitespace-nowrap h-8.5"
                  title="Upload a new driving licence"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload New</span>
                </button>
              )}
            </>
          ) : (
            /* Editing Mode: Show Cancel, Reset, and Save Changes */
            <>
              {isReviewed && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center justify-center space-x-1 text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-all cursor-pointer shadow-xs whitespace-nowrap h-8.5"
                  title="Cancel edits and return to saved view"
                >
                  <span>Cancel</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="inline-flex items-center justify-center space-x-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-all cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap h-8.5"
                title="Revert manual edits back to AI extraction"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center justify-center space-x-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-60 active:scale-95 whitespace-nowrap h-8.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-white" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`px-4 py-2.5 text-xs flex items-center justify-between border-b ${
            statusMessage.type === "success"
              ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/80"
              : statusMessage.type === "error"
              ? "bg-rose-950/60 text-rose-300 border-rose-800/80"
              : "bg-indigo-950/60 text-indigo-300 border-indigo-800/80"
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>

          {statusMessage.type === "success" && onNewUpload && (
            <button
              type="button"
              onClick={onNewUpload}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-[11px] font-bold cursor-pointer transition-all ml-3 shrink-0 active:scale-95"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Next Document →</span>
            </button>
          )}
        </div>
      )}

      {/* Form Fields Categorized Body */}
      <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 relative">
        {/* Loading overlay when saving */}
        {isSaving && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] z-30 flex items-center justify-center rounded-b-2xl animate-in fade-in duration-150">
            <div className="bg-slate-900/95 border border-indigo-500/40 px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-sm text-indigo-300 font-medium">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400 shrink-0" />
              <span>Saving verified data to database...</span>
            </div>
          </div>
        )}
        {FIELD_CATEGORIES.map((category, catIdx) => {
          const CategoryIcon = category.icon;

          return (
            <div key={catIdx} className="space-y-3">
              {/* Category section title */}
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <CategoryIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>{category.title}</span>
              </div>

              {/* Category fields */}
              <div className="space-y-3">
                {category.fields.map(({ key, label, placeholder, type, icon: FieldIcon }) => {
                  const rawField = document.extractedData?.[key] || {};
                  const isMissing = !formData[key] || formData[key].trim() === "";
                  const isEdited = Boolean(isEditedMap[key]);
                  const confidence = rawField.confidence;
                  const sourceText = rawField.sourceText;
                  const sourcePage = rawField.page || 1;
                  const isExp = Boolean(expandedEvidence[key]);

                  return (
                    <div
                      key={key}
                      className={`glass-card rounded-xl p-3 sm:p-3.5 border transition-all ${
                        isEdited
                          ? "border-amber-500/40 bg-amber-950/10"
                          : "border-slate-800/80 hover:border-slate-700 bg-slate-900/60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                          <FieldIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{label}</span>
                          {isEdited && (
                            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                              User Corrected
                            </span>
                          )}
                        </label>

                        {/* Field status & evidence toggle */}
                        <div className="flex items-center space-x-2 text-[11px]">
                          {isMissing && (
                            <span className="text-slate-500 italic bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60 text-[10px]">
                              Not detected
                            </span>
                          )}

                          {sourceText && (
                            <button
                              type="button"
                              onClick={() => toggleEvidence(key)}
                              className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 cursor-pointer transition-colors"
                              title="Toggle source grounding quote"
                            >
                              <FileSearch className="w-3 h-3" />
                              <span className="text-[11px] font-medium">Evidence</span>
                              {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {type === "textarea" ? (
                        <textarea
                          rows={2}
                          value={formData[key] || ""}
                          disabled={!isEditing}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          placeholder={placeholder}
                          className={`w-full text-xs sm:text-sm rounded-lg px-3 py-2 transition-all font-sans ${
                            !isEditing
                              ? "bg-slate-900/40 text-slate-200 border border-slate-800/80 cursor-default select-text focus:outline-hidden"
                              : "bg-slate-950/70 text-white border border-slate-700/80 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          }`}
                        />
                      ) : type === "date" || key === "dateOfBirth" || key === "dateOfIssue" || key === "dateOfExpiry" ? (
                        <div className="relative flex items-center">
                          <input
                            type="date"
                            value={toInputDateFormat(formData[key])}
                            disabled={!isEditing}
                            onClick={(e) => {
                              if (isEditing && e.target.showPicker) {
                                try {
                                  e.target.showPicker();
                                } catch (err) {}
                              }
                            }}
                            onKeyDown={(e) => {
                              if (isEditing && (e.key === "Enter" || e.key === " ") && e.target.showPicker) {
                                e.preventDefault();
                                try {
                                  e.target.showPicker();
                                } catch (err) {}
                              }
                            }}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            className={`custom-date-input w-full text-xs sm:text-sm rounded-lg pl-3 pr-10 py-2 transition-all font-mono [color-scheme:dark] ${
                              !isEditing
                                ? "bg-slate-900/40 text-slate-200 border border-slate-800/80 cursor-default select-text focus:outline-hidden"
                                : "bg-slate-950/70 text-white border border-slate-700/80 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            }`}
                          />
                          <div
                            className={`absolute right-3 pointer-events-none transition-colors ${
                              isEditing ? "text-indigo-400" : "text-slate-500"
                            }`}
                            title="Interactive calendar date picker"
                          >
                            <Calendar className="w-4 h-4" />
                          </div>
                        </div>
                      ) : (
                        <input
                          type={type}
                          value={formData[key] || ""}
                          disabled={!isEditing}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          placeholder={placeholder}
                          className={`w-full text-xs sm:text-sm rounded-lg px-3 py-2 transition-all ${
                            !isEditing
                              ? "bg-slate-900/40 text-slate-200 border border-slate-800/80 cursor-default select-text focus:outline-hidden"
                              : "bg-slate-950/70 text-white border border-slate-700/80 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          } ${
                            key === "licenceNumber" || key === "bloodGroup"
                              ? "font-mono"
                              : "font-sans"
                          }`}
                        />
                      )}

                      {/* Source Evidence Expandable Drawer */}
                      {isExp && sourceText && (
                        <div className="mt-2.5 p-2.5 bg-indigo-950/30 border border-indigo-800/50 rounded-lg text-xs">
                          <div className="flex items-center justify-between text-indigo-300 font-semibold mb-1">
                            <span className="flex items-center space-x-1">
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                              <span>Source OCR Grounding (Page {sourcePage}):</span>
                            </span>
                          </div>
                          <blockquote className="italic text-slate-300 font-mono text-[11px] border-l-2 border-indigo-400 pl-2.5 py-0.5 whitespace-pre-wrap">
                            "{sourceText}"
                          </blockquote>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </form>
    </div>
  );
}

