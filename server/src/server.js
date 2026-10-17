
import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  // Connect to MongoDB Atlas (if MONGODB_URI is provided)
  await connectDatabase();

  const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  server.on("error", (error) => {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
  });
};

startServer();

