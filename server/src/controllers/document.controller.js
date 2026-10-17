import mongoose from "mongoose";
import Document from "../models/Document.js";
import { parseDocument, removeTempFile } from "../services/parser.service.js";
import { extractLicenceData } from "../services/extraction.service.js";
import { answerQuestion } from "../services/rag.service.js";
import { isValidObjectId, normalizeDate } from "../utils/validators.js";
import { isNvidiaConfigured } from "../services/llm.service.js";

// In-memory fallback cache when MongoDB is temporarily disconnected
const inMemoryDocs = new Map();

const isDbConnected = () => mongoose.connection.readyState === 1;

export const uploadAndProcessDocument = async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      message: "No document file was uploaded. Please attach a PDF, JPG, JPEG, or PNG file.",
    });
  }

  let docId = null;

  try {
    // 1. Parse document (OCR / PDF extraction)
    const { ocrPages, fullText, method, previewDataUrl } = await parseDocument({
      filePath: file.path,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });

    if (!fullText || fullText.trim().length === 0) {
      await removeTempFile(file.path);
      return res.status(422).json({
        success: false,
        message: "Could not extract any readable text from the uploaded document.",
      });
    }

    // 2. Structured Information Extraction
    let extractedData = {};
    let fieldEvidence = [];
    let processingStatus = "completed";
    let errorMessage = null;

    try {
      const extraction = await extractLicenceData(ocrPages);
      extractedData = extraction.extractedData;
      fieldEvidence = extraction.fieldEvidence;

      if (extraction.method === "heuristic_ocr_fallback") {
        errorMessage = !isNvidiaConfigured()
          ? "Fields extracted via OCR pattern parser. (To enable 70B AI inference, configure NVIDIA_API_KEY in server/.env)."
          : `AI note: ${extraction.error} (extracted using OCR pattern parser)`;
      }
    } catch (extractErr) {
      console.error("⚠️  Extraction error:", extractErr.message);
      processingStatus = "failed";
      errorMessage = `Extraction error: ${extractErr.message}`;
    }

    // 3. Persist document
    const docPayload = {
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
      processingStatus,
      extractedData,
      reviewedData: null,
      reviewStatus: "unreviewed",
      ocrPages,
      fieldEvidence,
      previewDataUrl,
      errorMessage,
    };

    let savedDoc;
    if (isDbConnected()) {
      savedDoc = await Document.create(docPayload);
    } else {
      // In-memory fallback
      const mockId = new mongoose.Types.ObjectId().toString();
      savedDoc = {
        _id: mockId,
        ...docPayload,
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: () => ({ _id: mockId, ...docPayload }),
      };
      inMemoryDocs.set(mockId, savedDoc);
    }

    // Clean up temporary disk file
    await removeTempFile(file.path);

    return res.status(201).json({
      success: true,
      message:
        processingStatus === "completed"
          ? "Document uploaded and parsed successfully."
          : `Document uploaded and OCR processed, but extraction requires attention: ${errorMessage}`,
      data: savedDoc,
    });
  } catch (error) {
    // Ensure temporary file is cleaned up on failure
    await removeTempFile(file.path);
    console.error("❌ Document processing pipeline error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "An unexpected error occurred while processing the document.",
    });
  }
};

export const getDocuments = async (req, res) => {
  try {
    let docs = [];
    if (isDbConnected()) {
      docs = await Document.find()
        .select("-previewDataUrl -ocrPages") // Exclude large blobs from list view
        .sort({ createdAt: -1 });
    } else {
      docs = Array.from(inMemoryDocs.values()).map((d) => {
        const copy = { ...d };
        delete copy.previewDataUrl;
        delete copy.ocrPages;
        return copy;
      });
    }

    return res.status(200).json({
      success: true,
      count: docs.length,
      data: docs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to retrieve documents: ${error.message}`,
    });
  }
};

export const getDocumentById = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id) && !inMemoryDocs.has(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid document ID format.",
    });
  }

  try {
    let doc = null;
    if (isDbConnected()) {
      doc = await Document.findById(id);
    } else {
      doc = inMemoryDocs.get(id) || null;
    }

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error retrieving document: ${error.message}`,
    });
  }
};

export const updateDocument = async (req, res) => {
  const { id } = req.params;
  const { reviewedData, reviewStatus } = req.body;

  if (!isValidObjectId(id) && !inMemoryDocs.has(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid document ID format.",
    });
  }

  if (!reviewedData || typeof reviewedData !== "object") {
    return res.status(400).json({
      success: false,
      message: "reviewedData must be a valid object of field values.",
    });
  }

  try {
    let doc = null;
    if (isDbConnected()) {
      doc = await Document.findById(id);
    } else {
      doc = inMemoryDocs.get(id) || null;
    }

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    // Whitelist and sanitize reviewed fields to enforce strict schema and prevent mass-assignment
    const ALLOWED_FIELD_KEYS = [
      "fullName",
      "licenceNumber",
      "dateOfBirth",
      "bloodGroup",
      "dateOfIssue",
      "dateOfExpiry",
      "address",
      "issuingAuthority",
      "vehicleClasses",
      "otherInfo",
    ];

    const sanitizedReviewedData = {};
    ALLOWED_FIELD_KEYS.forEach((key) => {
      if (reviewedData[key] && typeof reviewedData[key] === "object") {
        let val =
          reviewedData[key].value !== undefined && reviewedData[key].value !== null
            ? String(reviewedData[key].value).trim()
            : null;
        if (val === "") val = null;

        // Disallow alphabets and sanitize date fields
        const isDateField = key === "dateOfBirth" || key === "dateOfIssue" || key === "dateOfExpiry";
        if (isDateField && val) {
          val = val.replace(/[^0-9\-/.]/g, "").trim();
          val = normalizeDate(val) || val;
        }

        sanitizedReviewedData[key] = {
          value: val,
          sourceText:
            typeof reviewedData[key].sourceText === "string"
              ? reviewedData[key].sourceText.slice(0, 1000)
              : null,
          page:
            Number.isInteger(reviewedData[key].page) && reviewedData[key].page > 0
              ? reviewedData[key].page
              : 1,
          confidence:
            typeof reviewedData[key].confidence === "number"
              ? Math.min(100, Math.max(0, Math.round(reviewedData[key].confidence)))
              : 100,
          isEdited: Boolean(reviewedData[key].isEdited),
        };
      }
    });

    doc.reviewedData = sanitizedReviewedData;
    doc.reviewStatus = reviewStatus || "reviewed";
    doc.updatedAt = new Date();

    if (isDbConnected()) {
      await doc.save();
    } else {
      inMemoryDocs.set(id, doc);
    }

    return res.status(200).json({
      success: true,
      message: "Document reviewed fields saved successfully.",
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update document: ${error.message}`,
    });
  }
};

export const chatDocument = async (req, res) => {
  const { id } = req.params;
  const { question, sessionId } = req.body;

  if (!isValidObjectId(id) && !inMemoryDocs.has(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid document ID format.",
    });
  }

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Question must be a non-empty string.",
    });
  }

  try {
    let doc = null;
    if (isDbConnected()) {
      doc = await Document.findById(id);
    } else {
      doc = inMemoryDocs.get(id) || null;
    }

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    // Ensure chatSessions array exists
    if (!doc.chatSessions) {
      doc.chatSessions = [];
    }

    // Find or initialize session
    let targetSession = null;
    if (sessionId) {
      targetSession = doc.chatSessions.find((s) => s.sessionId === sessionId);
    }

    if (!targetSession) {
      let cleanTitle = question.trim();
      const isGreeting =
        /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|day)|howdy|hola|namaste)(\s+there|\s+assistant|\s+bot|[!?.,\s])*$/i.test(
          cleanTitle
        );

      if (isGreeting) {
        cleanTitle = "General Inquiry";
      } else if (cleanTitle.length > 35) {
        cleanTitle = cleanTitle.slice(0, 35) + "...";
      }

      const newSessionId =
        sessionId ||
        "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);

      targetSession = {
        sessionId: newSessionId,
        title: cleanTitle,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      doc.chatSessions.unshift(targetSession);
      targetSession = doc.chatSessions[0];
    } else if (targetSession.title === "General Inquiry") {
      // If the session was started with a greeting, upgrade title with the first real question!
      const isStillGreeting =
        /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|day)|howdy|hola|namaste)(\s+there|[!?.,\s])*$/i.test(
          question.trim()
        );
      if (!isStillGreeting) {
        targetSession.title =
          question.trim().length > 35
            ? question.trim().slice(0, 35) + "..."
            : question.trim();
      }
    }

    const effectiveData = doc.reviewedData || doc.extractedData;
    const conversationHistory = targetSession.messages || [];

    const answerResult = await answerQuestion({
      question,
      ocrPages: doc.ocrPages,
      extractedData: effectiveData,
      conversationHistory,
    });

    const userMsg = {
      role: "user",
      content: question.trim(),
      evidence: [],
      isFound: true,
      isError: false,
      timestamp: new Date(),
    };

    const assistantMsg = {
      role: "assistant",
      content: answerResult.answer,
      evidence: answerResult.evidence || [],
      isFound: answerResult.isFound,
      isError: false,
      timestamp: new Date(),
    };

    targetSession.messages.push(userMsg);
    targetSession.messages.push(assistantMsg);
    targetSession.updatedAt = new Date();

    if (isDbConnected()) {
      doc.markModified("chatSessions");
      await doc.save();
    } else {
      inMemoryDocs.set(id, doc);
    }

    return res.status(200).json({
      success: true,
      data: answerResult,
      sessionId: targetSession.sessionId,
      session: targetSession,
      chatSessions: doc.chatSessions,
    });
  } catch (error) {
    console.error("❌ Chat Q&A error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "An error occurred while answering the question.",
    });
  }
};

export const deleteChatSession = async (req, res) => {
  const { id, sessionId } = req.params;

  try {
    let doc = null;
    if (isDbConnected()) {
      doc = await Document.findById(id);
    } else {
      doc = inMemoryDocs.get(id) || null;
    }

    if (!doc) {
      return res.status(404).json({ success: false, message: "Document not found." });
    }

    if (doc.chatSessions) {
      doc.chatSessions = doc.chatSessions.filter((s) => s.sessionId !== sessionId);
      if (isDbConnected()) {
        await doc.save();
      } else {
        inMemoryDocs.set(id, doc);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Chat session deleted.",
      chatSessions: doc.chatSessions || [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to delete chat session: ${error.message}`,
    });
  }
};

export const clearAllChatSessions = async (req, res) => {
  const { id } = req.params;

  try {
    let doc = null;
    if (isDbConnected()) {
      doc = await Document.findById(id);
    } else {
      doc = inMemoryDocs.get(id) || null;
    }

    if (!doc) {
      return res.status(404).json({ success: false, message: "Document not found." });
    }

    doc.chatSessions = [];
    if (isDbConnected()) {
      await doc.save();
    } else {
      inMemoryDocs.set(id, doc);
    }

    return res.status(200).json({
      success: true,
      message: "All chat sessions cleared.",
      chatSessions: [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to clear chat sessions: ${error.message}`,
    });
  }
};

export const deleteDocument = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id) && !inMemoryDocs.has(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid document ID format.",
    });
  }

  try {
    if (isDbConnected()) {
      const doc = await Document.findByIdAndDelete(id);
      if (!doc) {
        return res.status(404).json({ success: false, message: "Document not found." });
      }
    } else {
      if (!inMemoryDocs.has(id)) {
        return res.status(404).json({ success: false, message: "Document not found." });
      }
      inMemoryDocs.delete(id);
    }

    return res.status(200).json({
      success: true,
      message: "Document deleted successfully from MongoDB.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to delete document: ${error.message}`,
    });
  }
};

export const deleteAllDocuments = async (req, res) => {
  try {
    let deletedCount = 0;
    if (isDbConnected()) {
      const result = await Document.deleteMany({});
      deletedCount = result.deletedCount;
    } else {
      deletedCount = inMemoryDocs.size;
      inMemoryDocs.clear();
    }

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} document(s) from MongoDB.`,
      count: deletedCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to delete documents: ${error.message}`,
    });
  }
};

