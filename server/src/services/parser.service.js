import fs from "fs/promises";
import fsSync from "fs";
import { createRequire } from "module";
import { recognizeImage, normalizeOcrText } from "./ocr.service.js";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

export const removeTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
    }
  } catch (error) {
    console.warn(`⚠️  Failed to remove temporary file ${filePath}:`, error.message);
  }
};

const parseWithLlamaParse = async (filePath, mimeType) => {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey.startsWith("llx-your-key")) {
    return null;
  }

  try {
    const fileBuffer = await fs.readFile(filePath);
    const fileName = filePath.split("/").pop() || "document";

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append("file", blob, fileName);
    // LlamaParse requires a version parameter when specifying tier
    formData.append("version", "latest");
    formData.append("tier", "cost_effective");

    const uploadRes = await fetch(
      "https://api.cloud.llamaindex.ai/api/v1/parsing/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      }
    );

    if (!uploadRes.ok) {
      console.warn(
        `⚠️  LlamaParse upload rejected (${uploadRes.status}):`,
        await uploadRes.text()
      );
      return null;
    }

    const { id: jobId } = await uploadRes.json();
    if (!jobId) return null;

    // Poll for status with 12s ceiling (8 attempts * 1500ms) to ensure responsiveness
    const maxAttempts = 8;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const statusRes = await fetch(
        `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      if (!statusRes.ok) continue;
      const jobData = await statusRes.json();

      if (jobData.status === "SUCCESS") {
        const resultRes = await fetch(
          `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/markdown`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );

        if (resultRes.ok) {
          const resultData = await resultRes.json();
          const markdown = resultData.markdown || "";

          // Split pages by markdown horizontal rule page delimiters if available
          const rawPages = markdown.split(/\n---\n/);
          const ocrPages = rawPages.map((pageText, idx) => ({
            pageNumber: idx + 1,
            text: normalizeOcrText(pageText),
          }));

          return {
            ocrPages,
            fullText: normalizeOcrText(markdown),
            method: "llamaparse",
          };
        }
      } else if (jobData.status === "ERROR" || jobData.status === "CANCELLED") {
        console.warn("⚠️  LlamaParse job ended with status:", jobData.status);
        return null;
      }
    }

    console.warn("⚠️  LlamaParse cloud polling reached 12s threshold; switching instantly to local high-speed OCR.");
    return null;
  } catch (err) {
    console.warn("⚠️  LlamaParse request error:", err.message);
    return null;
  }
};

export const parseDocument = async ({ filePath, mimeType, originalName }) => {
  const fileBuffer = await fs.readFile(filePath);

  // Generate Base64 preview data URL for frontend rendering
  const previewDataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;

  // 1. Primary: LlamaParse (Cloud Document AI for PDFs and Images)
  const llamaResult = await parseWithLlamaParse(filePath, mimeType);
  if (llamaResult && llamaResult.fullText.trim().length > 0) {
    return {
      ...llamaResult,
      previewDataUrl,
    };
  }

  // 2. Fallback: Tesseract OCR (Local high-speed OCR engine)
  if (mimeType === "application/pdf") {
    try {
      // Render PDF pages to screenshot buffers so Tesseract OCR can process them
      const parser = new PDFParse({ data: fileBuffer });
      const screenshotRes = await parser.getScreenshot();

      if (screenshotRes?.pages?.length > 0) {
        const ocrPages = [];

        for (const page of screenshotRes.pages) {
          const imgBuffer = Buffer.from(page.data);
          const ocrResult = await recognizeImage(imgBuffer);
          ocrPages.push({
            pageNumber: page.pageNumber || (ocrPages.length + 1),
            text: ocrResult.text || "",
          });
        }

        const fullText = ocrPages.map((p) => p.text).join("\n\n").trim();
        if (fullText.length > 0) {
          return {
            ocrPages,
            fullText,
            method: "tesseract_ocr",
            previewDataUrl,
          };
        }
      }
    } catch (pdfError) {
      console.error("❌ PDF Tesseract OCR failed:", pdfError.message);
      throw new Error(`Failed to extract text from PDF: ${pdfError.message}`);
    }
  }

  if (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg" ||
    mimeType === "image/webp"
  ) {
    const ocrResult = await recognizeImage(filePath);

    if (!ocrResult.text || ocrResult.text.trim().length === 0) {
      throw new Error("OCR processed the document but found no readable text.");
    }

    return {
      ocrPages: [
        {
          pageNumber: 1,
          text: ocrResult.text,
        },
      ],
      fullText: ocrResult.text,
      method: "tesseract_ocr",
      previewDataUrl,
    };
  }

  throw new Error(`Unsupported document MIME type: ${mimeType}`);
};
