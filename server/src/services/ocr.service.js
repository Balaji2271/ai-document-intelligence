import Tesseract from "tesseract.js";

export const normalizeOcrText = (rawText) => {
  if (!rawText || typeof rawText !== "string") return "";

  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, idx, arr) => {
      // Allow single empty lines for paragraph separation, drop consecutive blanks
      if (line === "") {
        return idx > 0 && arr[idx - 1] !== "";
      }
      return true;
    })
    .join("\n")
    .trim();
};

export const recognizeImage = async (filePath) => {
  try {
    const result = await Tesseract.recognize(filePath, "eng", {
      logger: () => {}, // Suppress progress logging in production
    });

    const text = normalizeOcrText(result.data.text);
    const confidence = Math.round(result.data.confidence || 0);

    return {
      text,
      confidence,
    };
  } catch (error) {
    console.error("❌ Tesseract OCR recognition failed:", error.message);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
};
