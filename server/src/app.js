import express from "express";
import cors from "cors";
import documentRoutes from "./routes/document.routes.js";
import { getDatabaseStatus } from "./config/database.js";
import { isNvidiaConfigured } from "./services/llm.service.js";

const app = express();

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || origin === clientUrl || origin === "http://localhost:5173") {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for local development
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Existing health check endpoint
app.get("/api/health", (req, res) => {
  const dbStatus = getDatabaseStatus();
  res.status(200).json({
    success: true,
    message: "AI Document Intelligence API is running",
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus.isConnected ? "connected" : "disconnected",
      nvidiaLlm: isNvidiaConfigured() ? "configured" : "unconfigured",
      llamaParse: Boolean(process.env.LLAMA_CLOUD_API_KEY) ? "configured" : "fallback_mode",
    },
  });
});

// Mount document intelligence routes
app.use("/api/documents", documentRoutes);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Unhandled server error:", err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

export default app;
