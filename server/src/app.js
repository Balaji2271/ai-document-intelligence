import express from "express";
import cors from "cors";
import documentRoutes from "./routes/document.routes.js";
import { getDatabaseStatus } from "./config/database.js";
import { isNvidiaConfigured } from "./services/llm.service.js";

const app = express();

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const isProduction = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server health checks)
      if (!origin) return callback(null, true);

      // Whitelist intended frontend origins
      const allowedOrigins = [
        clientUrl,
        "http://localhost:5173",
        "http://localhost:3000",
      ];

      const isAllowed =
        allowedOrigins.some((ao) => ao && origin === ao.replace(/\/+$/, "")) ||
        origin.endsWith(".vercel.app");

      if (isAllowed || !isProduction) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
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
  const statusCode = err.statusCode || (err.message && err.message.includes("CORS") ? 403 : 500);

  // Prevent leaking internal stack traces or raw database credentials to clients
  let clientMessage = err.message || "An unexpected error occurred.";
  if (isProduction && statusCode === 500) {
    clientMessage = "Internal server error. Please try again later.";
  }

  // Strip any accidental connection strings or credentials from error messages
  clientMessage = clientMessage.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "[DATABASE_URI_REDACTED]");

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
  });
});

export default app;
