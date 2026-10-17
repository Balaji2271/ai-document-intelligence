import mongoose from "mongoose";

export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
};

export const normalizeDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;

  const trimmed = dateStr.trim();

  // Pattern YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Pattern DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ukMatch) {
    const [, d, m, y] = ukMatch;
    // Basic day/month bounds validation
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  return trimmed;
};
