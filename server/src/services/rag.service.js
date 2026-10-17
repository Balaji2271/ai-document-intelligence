import { callNvidiaChat, isNvidiaConfigured } from "./llm.service.js";

const STOP_WORDS = new Set([
  "what", "is", "the", "a", "an", "of", "in", "for", "to", "and", "or", "on",
  "at", "by", "from", "with", "about", "this", "that", "it", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "can", "could", "will", "would", "shall", "should", "tell", "me", "show",
  "who", "where", "when", "how", "which", "person", "please"
]);

// Common licence domain synonyms and abbreviation mappings
const SYNONYMS = {
  number: ["no", "num", "dl", "licence", "license"],
  expiry: ["valid", "till", "expire", "validity"],
  issue: ["doi", "issued"],
  birth: ["dob", "born"],
  vehicle: ["class", "cov", "drive", "authorisation", "lmv", "mcwg"],
  authority: ["rto", "transport", "department", "issuing"],
};

export const extractKeywords = (text) => {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const expanded = new Set(words);
  words.forEach((w) => {
    if (SYNONYMS[w]) {
      SYNONYMS[w].forEach((syn) => expanded.add(syn));
    }
    // Also reverse match synonyms
    for (const [key, synList] of Object.entries(SYNONYMS)) {
      if (synList.includes(w)) {
        expanded.add(key);
      }
    }
  });

  return Array.from(expanded);
};

export const retrieveEvidence = (question, ocrPages) => {
  if (!Array.isArray(ocrPages) || ocrPages.length === 0) return [];

  const keywords = extractKeywords(question);
  const scoredSnippets = [];

  ocrPages.forEach((page) => {
    const lines = page.text.split("\n").filter((l) => l.trim().length > 0);

    lines.forEach((line) => {
      const lower = line.toLowerCase();
      let matchCount = 0;

      keywords.forEach((kw) => {
        if (lower.includes(kw)) matchCount++;
      });

      if (matchCount > 0) {
        scoredSnippets.push({
          page: page.pageNumber,
          snippet: line.trim(),
          score: matchCount,
        });
      }
    });
  });

  // Sort descending by score
  scoredSnippets.sort((a, b) => b.score - a.score);

  if (scoredSnippets.length > 0) {
    return scoredSnippets.slice(0, 5);
  }

  // Fallback: return the first available line from page 1 as context
  const firstLine = ocrPages[0]?.text?.split("\n").find((l) => l.trim().length > 0);
  if (firstLine) {
    return [{ page: 1, snippet: firstLine.trim(), score: 0 }];
  }

  return [];
};

const GREETING_REGEX =
  /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|day)|howdy|hola|namaste|who\s+are\s+you|what\s+can\s+you\s+do|help|what\s+is\s+this)(\s+there|\s+assistant|\s+bot|[!?.,\s])*$/i;

const RAG_SYSTEM_PROMPT = `You are a strict, factual document Q&A assistant for driving licences.
Your objective is to answer user questions using EXCLUSIVELY the provided Document Context.

STRICT INSTRUCTIONS:
1. Base your factual answers ONLY on the provided Document Context.
2. If the user greeting is conversational (e.g., "hello", "hi", "how are you", "what can you do", "who are you"), respond politely, introduce yourself as the AI Document Assistant for this licence, and invite questions with "isFound": true and "evidence": [].
3. For factual questions about the document, if the requested information is NOT explicitly stated in the context, your answer MUST BE EXACTLY:
   "I couldn't find this information in the uploaded document."
   Set "isFound" to false and "evidence" to [].
4. DO NOT extrapolate, assume, or use any outside knowledge.
5. Output MUST be a valid JSON object matching this schema:
   {
     "answer": string,
     "isFound": boolean,
     "evidence": [
       { "page": number, "quote": string }
     ]
   }
6. Do not include markdown code blocks or additional commentary outside the JSON object.`;

export const answerQuestion = async ({ question, ocrPages, extractedData, conversationHistory = [] }) => {
  if (!question || typeof question !== "string" || question.trim() === "") {
    throw new Error("Question cannot be empty.");
  }

  // Fast-path: Friendly conversational greetings and pleasantries
  if (GREETING_REGEX.test(question.trim())) {
    const holder = extractedData?.fullName?.value
      ? ` for ${extractedData.fullName.value}'s licence`
      : "";
    return {
      answer: `Hello! I am your AI Document Assistant${holder}. You can ask any question about this driving licence, such as the licence number, validity dates, authorised vehicle classes (COV), blood group, or issuing authority.`,
      isFound: true,
      evidence: [],
    };
  }

  if (!Array.isArray(ocrPages) || ocrPages.length === 0) {
    return {
      answer: "I couldn't find this information in the uploaded document.",
      isFound: false,
      evidence: [],
    };
  }

  // Find top matching snippets for keyword context
  const retrieved = retrieveEvidence(question, ocrPages);

  // If NVIDIA is not configured, ground the answer directly on retrieved evidence
  if (!isNvidiaConfigured()) {
    if (retrieved.length > 0 && retrieved[0].score > 0) {
      return {
        answer: `According to the document (Page ${retrieved[0].page}): "${retrieved[0].snippet}"`,
        isFound: true,
        evidence: retrieved.map((r) => ({ page: r.page, quote: r.snippet })),
      };
    } else {
      return {
        answer: "I couldn't find this information in the uploaded document.",
        isFound: false,
        evidence: [],
      };
    }
  }

  // Format document context with page numbers
  const formattedPages = ocrPages
    .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
    .join("\n\n");

  let extractedContext = "";
  if (extractedData) {
    const verified = Object.entries(extractedData)
      .filter(([, f]) => f && f.value !== null && f.value !== "")
      .map(([k, f]) => `- ${k}: ${JSON.stringify(f.value)} (source: "${f.sourceText || ""}", page ${f.page || 1})`)
      .join("\n");
    if (verified) {
      extractedContext = `\nVerified Licence Data:\n${verified}\n`;
    }
  }

  let historyContext = "";
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const recent = conversationHistory
      .slice(-4)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");
    if (recent) {
      historyContext = `\nRecent Session Dialogue:\n${recent}\n`;
    }
  }

  const userPrompt = `Document Context:
${formattedPages}
${extractedContext}
${historyContext}
Top Matching Evidence Lines:
${retrieved.map((r) => `[Page ${r.page}] "${r.snippet}"`).join("\n")}

User Question: ${question.trim()}`;

  const messages = [
    { role: "system", content: RAG_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  let rawResponse = null;
  try {
    rawResponse = await callNvidiaChat({
      messages,
      temperature: 0.0,
      maxTokens: 1024,
    });
  } catch (llmError) {
    console.warn(
      `⚠️ [RAG] All LLM models failed or timed out (${llmError.message}). Utilizing deterministic OCR evidence fallback.`
    );
    if (retrieved.length > 0 && retrieved[0].score > 0) {
      return {
        answer: `According to the document (Page ${retrieved[0].page}): "${retrieved[0].snippet}"`,
        isFound: true,
        evidence: retrieved.map((r) => ({ page: r.page, quote: r.snippet })),
      };
    } else {
      return {
        answer: "I couldn't find this information in the uploaded document.",
        isFound: false,
        evidence: [],
      };
    }
  }

  // Clean JSON response
  let cleanJson = rawResponse.trim();
  if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  // Sanitize illegal escaped single quotes in JSON (e.g. couldn\'t -> couldn't)
  cleanJson = cleanJson.replace(/\\'/g, "'");

  // Extract JSON object if surrounded by markdown or commentary
  const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanJson = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(cleanJson);
    const isFound = Boolean(parsed.isFound);
    const answer = isFound
      ? (parsed.answer || "").trim()
      : "I couldn't find this information in the uploaded document.";

    const evidence = Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((e) => e && typeof e.quote === "string" && e.quote.trim().length > 0)
      : [];

    return {
      answer,
      isFound,
      evidence: isFound ? evidence : [],
    };
  } catch (err) {
    console.error("❌ Failed to parse RAG JSON from LLM:\n", rawResponse);
    if (
      cleanJson.toLowerCase().includes("couldn't find") ||
      cleanJson.toLowerCase().includes("not found")
    ) {
      return {
        answer: "I couldn't find this information in the uploaded document.",
        isFound: false,
        evidence: [],
      };
    }

    return {
      answer: cleanJson,
      isFound: true,
      evidence: retrieved.map((r) => ({ page: r.page, quote: r.snippet })),
    };
  }
};
