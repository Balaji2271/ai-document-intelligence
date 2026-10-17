import mongoose from "mongoose";

const ExtractedFieldSchema = new mongoose.Schema(
  {
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    sourceText: { type: String, default: null },
    page: { type: Number, default: 1 },
    confidence: { type: Number, default: null },
    isEdited: { type: Boolean, default: false },
  },
  { _id: false }
);

const ChatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    evidence: [
      {
        page: { type: Number, default: 1 },
        quote: { type: String, default: "" },
      },
    ],
    isFound: { type: Boolean, default: true },
    isError: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ChatSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    title: { type: String, default: "New Conversation" },
    messages: [ChatMessageSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const DocumentSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    extractedData: {
      fullName: { type: ExtractedFieldSchema, default: () => ({}) },
      licenceNumber: { type: ExtractedFieldSchema, default: () => ({}) },
      dateOfBirth: { type: ExtractedFieldSchema, default: () => ({}) },
      dateOfIssue: { type: ExtractedFieldSchema, default: () => ({}) },
      dateOfExpiry: { type: ExtractedFieldSchema, default: () => ({}) },
      address: { type: ExtractedFieldSchema, default: () => ({}) },
      vehicleClasses: { type: ExtractedFieldSchema, default: () => ({}) },
      issuingAuthority: { type: ExtractedFieldSchema, default: () => ({}) },
      bloodGroup: { type: ExtractedFieldSchema, default: () => ({}) },
      otherInfo: { type: ExtractedFieldSchema, default: () => ({}) },
    },
    reviewedData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reviewStatus: {
      type: String,
      enum: ["unreviewed", "reviewed", "flagged"],
      default: "unreviewed",
      index: true,
    },
    ocrPages: [
      {
        pageNumber: { type: Number, required: true },
        text: { type: String, default: "" },
      },
    ],
    fieldEvidence: [
      {
        field: { type: String, required: true },
        evidence: { type: String, default: "" },
        page: { type: Number, default: 1 },
      },
    ],
    chatSessions: {
      type: [ChatSessionSchema],
      default: [],
    },
    previewDataUrl: {
      type: String,
      default: null, // Data URL or preview reference for displaying the document
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual property to check if document has been reviewed
DocumentSchema.virtual("isReviewed").get(function () {
  return this.reviewStatus === "reviewed";
});

const Document = mongoose.model("Document", DocumentSchema);

export default Document;
