import fs from "fs";
import path from "path";
import { parseDocument } from "./src/services/parser.service.js";
import { normalizeDate, isValidObjectId } from "./src/utils/validators.js";
import { retrieveEvidence } from "./src/services/rag.service.js";

async function runVerification() {
  console.log("==================================================");
  console.log("🚀 Starting AI Document Intelligence Verification");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${description}`);
      failed++;
    }
  };

  // Test 1: Date normalizer
  console.log("\n[1] Testing Date Normalization:");
  assert(normalizeDate("16-06-2019") === "2019-06-16", "Normalizes DD-MM-YYYY to YYYY-MM-DD");
  assert(normalizeDate("2019/06/16") === "2019-06-16", "Normalizes YYYY/MM/DD to YYYY-MM-DD");
  assert(normalizeDate("invalid") === "invalid", "Preserves ambiguous dates without guessing");
  assert(normalizeDate(null) === null, "Handles null dates cleanly");

  // Test 2: MongoDB ObjectId validator
  console.log("\n[2] Testing MongoDB ObjectId Validator:");
  assert(isValidObjectId("507f1f77bcf86cd799439011") === true, "Valid 24-char hex ObjectId passes");
  assert(isValidObjectId("invalid-id-123") === false, "Invalid string fails ObjectId test");
  assert(isValidObjectId(null) === false, "Null fails ObjectId test");

  // Test 3: Document Parser & OCR on Sample Licence
  console.log("\n[3] Testing Parser & OCR Service on Sample Licence:");
  const samplePath = path.resolve("../sample_data/sample_licences.png");
  if (!fs.existsSync(samplePath)) {
    console.error("Sample licence not found at:", samplePath);
    failed++;
  } else {
    try {
      const parsed = await parseDocument({
        filePath: samplePath,
        mimeType: "image/png",
        originalName: "sample_licences.png",
      });

      assert(parsed.ocrPages.length >= 1, "Preserves page structure (ocrPages array)");
      assert(parsed.fullText.length > 50, "Extracted non-trivial OCR text");
      assert(
        parsed.fullText.toLowerCase().includes("licence") ||
          parsed.fullText.toLowerCase().includes("driving"),
        "Extracted driving licence text accurately"
      );
      assert(
        parsed.previewDataUrl.startsWith("data:image/png;base64,"),
        "Generated Base64 preview data URL"
      );

      // Test 4: Keyword evidence retrieval (RAG)
      console.log("\n[4] Testing Keyword Evidence Retrieval (RAG):");
      const evidence = retrieveEvidence("What is the licence number?", parsed.ocrPages);
      assert(evidence.length > 0, "Retrieved evidence snippets for licence number query");
      assert(evidence[0].page === 1, "Accurately attributes source page number 1");
      console.log(`   Sample retrieved snippet: "${evidence[0]?.snippet}"`);
    } catch (err) {
      console.error("Parser failure:", err);
      failed++;
    }
  }

  console.log("\n==================================================");
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
