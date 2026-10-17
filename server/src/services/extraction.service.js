import { callNvidiaChat, isNvidiaConfigured } from "./llm.service.js";
import { normalizeDate } from "../utils/validators.js";

const EXTRACTION_SYSTEM_PROMPT = `You are a strict, precise document intelligence extraction engine for driving licences.
Your task is to extract structured fields from the provided document OCR text.
Output MUST be a single valid JSON object strictly adhering to the schema below.
DO NOT wrap your output in conversational text or explanations.

SCHEMA:
{
  "fullName": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null },
  "licenceNumber": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null },
  "dateOfBirth": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null },
  "dateOfIssue": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null },
  "dateOfExpiry": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null },
  "address": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null },
  "vehicleClasses": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null },
  "issuingAuthority": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null },
  "bloodGroup": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null },
  "otherInfo": { "value": string|null, "sourceText": string|null, "page": number, "confidence": number|null }
}

RULES:
1. ONLY extract information explicitly stated in the document text.
2. If missing, set "value": null, "sourceText": null, "confidence": null.
3. Preserve licence numbers EXACTLY as written.
4. Normalize dates to YYYY-MM-DD format whenever day, month, and year are clearly identifiable.
5. "bloodGroup" must extract the blood type (e.g. A+, B+, O+, AB+, A-, B-, O-, AB-) if explicitly present.
6. "otherInfo" must capture relation (S/D/W of: Name) or any other extra notes, NOT vehicle classes.
7. "sourceText" must be the exact substring from the document.`;

export const sanitizeField = (rawField, isDateField = false) => {
  if (!rawField || typeof rawField !== "object") {
    return { value: null, sourceText: null, page: 1, confidence: null, isEdited: false };
  }

  let value = rawField.value !== undefined ? rawField.value : null;
  if (typeof value === "string") {
    value = value.trim();
    if (value === "" || value.toLowerCase() === "null" || value.toLowerCase() === "n/a") {
      value = null;
    }
  }

  if (isDateField && value) {
    value = normalizeDate(value);
  }

  const sourceText =
    typeof rawField.sourceText === "string" && rawField.sourceText.trim() !== ""
      ? rawField.sourceText.trim()
      : null;

  const page = Number.isInteger(rawField.page) && rawField.page > 0 ? rawField.page : 1;

  let confidence = null;
  if (rawField.confidence !== null && rawField.confidence !== undefined) {
    const num = Number(rawField.confidence);
    if (!isNaN(num)) {
      confidence = Math.max(0, Math.min(100, Math.round(num)));
    }
  }

  return {
    value,
    sourceText,
    page,
    confidence,
    isEdited: false,
  };
};

export const extractLicenceDataHeuristic = (ocrPages) => {
  if (!Array.isArray(ocrPages) || ocrPages.length === 0) {
    return { extractedData: {}, fieldEvidence: [] };
  }

  const rawCombined = ocrPages.map((p) => p.text).join("\n");
  // Clean markdown asterisks, underscores, hashes, and backticks to support LlamaParse formatting
  const cleanText = rawCombined.replace(/[*_#\`]/g, "");
  const extracted = {};

  // 1. Licence Number (e.g. MH12 20190001234 or DL-0420110005678)
  const dlMatch =
    cleanText.match(/(?:Driving\s+Licence\s+No\.?|DL\s+No\.?)\s*[:.-]?\s*([A-Za-z0-9]{2,4}[-\s]?[0-9]{4,16})/i) ||
    cleanText.match(/(?:Driving\s+Licence\s+No\.?|DL\s+No\.?)\s*[:.-]?\s*([A-Za-z0-9/-]{8,24})(?=\n|$)/i);
  if (dlMatch) {
    extracted.licenceNumber = {
      value: dlMatch[1].trim(),
      sourceText: dlMatch[0].trim(),
      page: 1,
      confidence: 95,
      isEdited: false,
    };
  }

  // 2. Full Name (e.g. ROHAN ANIL DESHMUKH or PRIYA SHARMA)
  const nameMatch = cleanText.match(/(?:^|\n)\s*Name\s*[:.-]\s*([A-Za-z\s]{3,35})(?=\n|$|[0-9])/i);
  if (nameMatch) {
    extracted.fullName = {
      value: nameMatch[1].trim().replace(/\s+/g, " "),
      sourceText: nameMatch[0].trim(),
      page: 1,
      confidence: 92,
      isEdited: false,
    };
  }

  // 3. Date of Birth
  const dobMatch = cleanText.match(/(?:Date\s+of\s+Birth|DOB)\s*[:.-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i);
  if (dobMatch) {
    extracted.dateOfBirth = {
      value: normalizeDate(dobMatch[1].trim()),
      sourceText: dobMatch[0].trim(),
      page: 1,
      confidence: 90,
      isEdited: false,
    };
  }

  // 4. Date of Issue
  const doiMatch = cleanText.match(/(?:Date\s+of\s+Issue|DOI)\s*[:.-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i);
  if (doiMatch) {
    extracted.dateOfIssue = {
      value: normalizeDate(doiMatch[1].trim()),
      sourceText: doiMatch[0].trim(),
      page: 1,
      confidence: 90,
      isEdited: false,
    };
  }

  // 5. Date of Expiry
  const expiryMatch = cleanText.match(/(?:Valid\s+Till?|Expiry\s+Date|Valid\s+Upto)\s*[:.©-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i);
  if (expiryMatch) {
    extracted.dateOfExpiry = {
      value: normalizeDate(expiryMatch[1].trim()),
      sourceText: expiryMatch[0].trim(),
      page: 1,
      confidence: 90,
      isEdited: false,
    };
  }

  // 6. Address
  const addrMatch = cleanText.match(/Address\s*[:.-]?\s*([\s\S]*?)(?=(?:\||Valid\s+for\s+Class|Authorization|Date\s+of\s+Issue|DOI|DOB|COV|$))/i);
  if (addrMatch) {
    const rawAddr = addrMatch[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.includes("|") && !l.toLowerCase().includes("blood"))
      .join(", ")
      .replace(/,\s*,/g, ",");

    extracted.address = {
      value: rawAddr.trim(),
      sourceText: addrMatch[0].trim().slice(0, 160),
      page: 1,
      confidence: 88,
      isEdited: false,
    };
  }

  // 7. Vehicle Classes
  const detectedVehicles = [];
  const knownClasses = ["LMV (NT)", "MCWG (NT)", "LMV", "MCWG", "HMV", "HGMV", "TRANS", "3W-NT", "3W-CAB"];
  knownClasses.forEach((cls) => {
    if (cleanText.includes(cls) && !detectedVehicles.includes(cls)) {
      detectedVehicles.push(cls);
    }
  });

  if (detectedVehicles.length > 0) {
    extracted.vehicleClasses = {
      value: detectedVehicles.join(", "),
      sourceText: `Valid for Class of Vehicle: ${detectedVehicles.join(", ")}`,
      page: 1,
      confidence: 90,
      isEdited: false,
    };
  } else {
    const covMatch = cleanText.match(/(?:(?:Authorisation\s+to\s+Drive|COV|Class\s+of\s+Vehicle)\s*[:.-]?\s*)([A-Za-z0-9\s,()./-]+?)(?=\n[A-Za-z]|\n\n|Holder|$|Figo)/i);
    if (covMatch) {
      extracted.vehicleClasses = {
        value: covMatch[1].trim(),
        sourceText: covMatch[0].trim(),
        page: 1,
        confidence: 88,
        isEdited: false,
      };
    }
  }

  // 8. Issuing Authority
  let authMatch =
    cleanText.match(/(?:Transport\s+Department[,\s]+[A-Za-z]+)/i) ||
    cleanText.match(/(?:RTO[,\s]+[A-Za-z]+)/i) ||
    cleanText.match(/(?:(?:Signature\s+of\s+Issuing\s+Authority|Issuing\s+Authority)\s*[:.-]?\s*[\n\r]*)([A-Za-z\s,.-]+?)(?=\n\n|DRIVE|Holder|$|Sample)/i);
  if (authMatch) {
    const val = authMatch[1] ? authMatch[1].trim() : authMatch[0].trim();
    extracted.issuingAuthority = {
      value: val.replace(/\n/g, " "),
      sourceText: authMatch[0].trim(),
      page: 1,
      confidence: 88,
      isEdited: false,
    };
  }

  // 9. Blood Group (Dedicated field e.g. A+, B+, O+, AB+)
  const bgMatch = cleanText.match(/(?:Blood\s*Group|BG)\s*[:.-]?\s*([A-Za-z0-9+-]{1,5})/i);
  if (bgMatch) {
    extracted.bloodGroup = {
      value: bgMatch[1].trim(),
      sourceText: bgMatch[0].trim(),
      page: 1,
      confidence: 95,
      isEdited: false,
    };
  }

  // 10. Other Info (Relation: Father/Spouse/Guardian)
  const relMatch = cleanText.match(/(?:S\/D\/W\s*of|Father'?s\s*Name|Relation)\s*[:.-]?\s*([A-Za-z\s]+?)(?=\n|$|[0-9])/i);
  if (relMatch) {
    extracted.otherInfo = {
      value: `Relation (S/D/W): ${relMatch[1].trim()}`,
      sourceText: relMatch[0].trim(),
      page: 1,
      confidence: 90,
      isEdited: false,
    };
  }

  const finalExtracted = {
    fullName: sanitizeField(extracted.fullName),
    licenceNumber: sanitizeField(extracted.licenceNumber),
    dateOfBirth: sanitizeField(extracted.dateOfBirth, true),
    dateOfIssue: sanitizeField(extracted.dateOfIssue, true),
    dateOfExpiry: sanitizeField(extracted.dateOfExpiry, true),
    address: sanitizeField(extracted.address),
    vehicleClasses: sanitizeField(extracted.vehicleClasses),
    issuingAuthority: sanitizeField(extracted.issuingAuthority),
    bloodGroup: sanitizeField(extracted.bloodGroup),
    otherInfo: sanitizeField(extracted.otherInfo),
  };

  const fieldEvidence = [];
  for (const [fieldName, fieldObj] of Object.entries(finalExtracted)) {
    if (fieldObj.sourceText && fieldObj.value !== null) {
      fieldEvidence.push({
        field: fieldName,
        evidence: fieldObj.sourceText,
        page: fieldObj.page,
      });
    }
  }

  return {
    extractedData: finalExtracted,
    fieldEvidence,
  };
};

export const extractLicenceData = async (ocrPages) => {
  if (!Array.isArray(ocrPages) || ocrPages.length === 0) {
    throw new Error("Cannot extract data: No document text provided.");
  }

  // Generate robust baseline
  const baseline = extractLicenceDataHeuristic(ocrPages);

  if (!isNvidiaConfigured()) {
    return {
      ...baseline,
      method: "heuristic_ocr_fallback",
    };
  }

  const formattedDoc = ocrPages
    .map(
      (page) => `=== START OF PAGE ${page.pageNumber} ===\n${page.text}\n=== END OF PAGE ${page.pageNumber} ===`
    )
    .join("\n\n");

  const messages = [
    { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Extract all driving licence fields from the following document:\n\n${formattedDoc}`,
    },
  ];

  try {
    const rawResponse = await callNvidiaChat({
      messages,
      temperature: 0.1,
      maxTokens: 1024,
    });

    let cleanJson = rawResponse.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleanJson);
    const mergedData = {};

    for (const key of Object.keys(baseline.extractedData)) {
      const llmField = sanitizeField(parsed[key], key.includes("date") || key.includes("Date"));
      const baseField = baseline.extractedData[key];

      // Use LLM field if valid, otherwise fallback to baseline
      if (llmField && llmField.value !== null && llmField.value !== "") {
        mergedData[key] = llmField;
      } else {
        mergedData[key] = baseField;
      }
    }

    const fieldEvidence = [];
    for (const [fieldName, fieldObj] of Object.entries(mergedData)) {
      if (fieldObj.sourceText && fieldObj.value !== null) {
        fieldEvidence.push({
          field: fieldName,
          evidence: fieldObj.sourceText,
          page: fieldObj.page || 1,
        });
      }
    }

    return {
      extractedData: mergedData,
      fieldEvidence,
      method: "nvidia_nim_llm",
    };
  } catch (err) {
    console.warn("⚠️ NVIDIA NIM extraction slow or failed, using robust baseline:", err.message);
    return {
      ...baseline,
      method: "hybrid_pattern_fallback",
      error: err.message,
    };
  }
};
