import { Router } from "express";
import {
  uploadAndProcessDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  chatDocument,
  deleteChatSession,
  clearAllChatSessions,
  deleteDocument,
  deleteAllDocuments,
} from "../controllers/document.controller.js";
import { upload, handleUploadError } from "../middleware/upload.middleware.js";

const router = Router();

// Document upload, list, and wipe
router.post(
  "/",
  upload.single("document"),
  handleUploadError,
  uploadAndProcessDocument
);
router.get("/", getDocuments);
router.delete("/", deleteAllDocuments);

// Single document operations
router.get("/:id", getDocumentById);
router.patch("/:id", updateDocument);
router.delete("/:id", deleteDocument);

// Document grounded RAG chat & session management
router.post("/:id/chat", chatDocument);
router.delete("/:id/sessions/:sessionId", deleteChatSession);
router.delete("/:id/sessions", clearAllChatSessions);

export default router;

