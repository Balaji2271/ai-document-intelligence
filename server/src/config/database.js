import mongoose from "mongoose";

let isConnected = false;

export const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn(
      "⚠️  [Database] MONGODB_URI is not set in server/.env. Database operations will return 503 until configured."
    );
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: "ai_document_intelligence",
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(
      `✅ [Database] Connected to MongoDB Atlas (${conn.connection.host}/${conn.connection.name})`
    );
    return true;
  } catch (error) {
    isConnected = false;
    console.error("❌ [Database] Connection failed:", error.message);
    return false;
  }
};

export const getDatabaseStatus = () => {
  return {
    isConnected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
  };
};
