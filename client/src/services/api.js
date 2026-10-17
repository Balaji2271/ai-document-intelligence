import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 180000, // 180s (3 min) timeout for multi-tier OCR + LLM operations
});


export const checkHealth = async () => {
  const response = await apiClient.get("/health");
  return response.data;
};

export const uploadDocument = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("document", file);

  const response = await apiClient.post("/documents", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress,
  });

  return response.data;
};

export const getDocuments = async () => {
  const response = await apiClient.get("/documents");
  return response.data;
};

export const getDocumentById = async (id) => {
  const response = await apiClient.get(`/documents/${id}`);
  return response.data;
};

export const updateDocument = async (id, reviewedData, reviewStatus = "reviewed") => {
  const response = await apiClient.patch(`/documents/${id}`, {
    reviewedData,
    reviewStatus,
  });
  return response.data;
};

export const askQuestion = async (id, question, sessionId = null) => {
  const payload = { question };
  if (sessionId) payload.sessionId = sessionId;

  const response = await apiClient.post(`/documents/${id}/chat`, payload);
  return response.data;
};

export const deleteChatSession = async (id, sessionId) => {
  const response = await apiClient.delete(`/documents/${id}/sessions/${sessionId}`);
  return response.data;
};

export const clearAllChatSessions = async (id) => {
  const response = await apiClient.delete(`/documents/${id}/sessions`);
  return response.data;
};

export const deleteDocument = async (id) => {
  const response = await apiClient.delete(`/documents/${id}`);
  return response.data;
};

export const deleteAllDocuments = async () => {
  const response = await apiClient.delete("/documents");
  return response.data;
};

export default apiClient;

