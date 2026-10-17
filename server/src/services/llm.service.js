export const isNvidiaConfigured = () => {
  const apiKey = process.env.NVIDIA_API_KEY;
  return Boolean(
    apiKey &&
      apiKey.trim().length > 0 &&
      !apiKey.startsWith("nvapi-your-key")
  );
};

const executeSingleChatRequest = async ({
  model,
  endpoint,
  apiKey,
  messages,
  temperature,
  maxTokens,
  responseFormat,
  timeoutMs,
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let detailedMsg = errorText;

      try {
        const parsed = JSON.parse(errorText);
        detailedMsg = parsed.error?.message || parsed.message || errorText;
      } catch {
        // Keep raw text
      }

      if (response.status === 401) {
        const err = new Error(`Invalid or expired NVIDIA API key: ${detailedMsg}`);
        err.statusCode = 401;
        throw err;
      }

      if (response.status === 429) {
        const err = new Error(
          `NVIDIA API rate limit exceeded for "${model}": ${detailedMsg}`
        );
        err.statusCode = 429;
        throw err;
      }

      const err = new Error(
        `NVIDIA LLM API returned status ${response.status} for model "${model}": ${detailedMsg}`
      );
      err.statusCode = response.status >= 500 ? 502 : response.status;
      throw err;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      throw new Error(`NVIDIA model "${model}" returned an empty response.`);
    }

    return content.trim();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      const timeoutError = new Error(
        `NVIDIA API request for model "${model}" timed out after ${timeoutMs / 1000} seconds.`
      );
      timeoutError.statusCode = 504;
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    throw error;
  }
};

export const callNvidiaChat = async ({
  messages,
  temperature = 0.1,
  maxTokens = 2048,
  responseFormat = null,
  model = null,
  timeoutMs = null,
}) => {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!isNvidiaConfigured()) {
    const error = new Error(
      "NVIDIA_API_KEY is not configured in server/.env. Please configure your API key from https://build.nvidia.com/."
    );
    error.code = "MISSING_NVIDIA_CREDENTIALS";
    error.statusCode = 401;
    throw error;
  }

  const primaryModel = model || process.env.NVIDIA_MODEL || "meta/llama-3.2-11b-vision-instruct";
  const fallbackEnv =
    process.env.NVIDIA_FALLBACK_MODEL ||
    "google/diffusiongemma-26b-a4b-it,poolside/laguna-xs-2.1";
  const fallbackModels = fallbackEnv
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  // Build candidate model list in priority order (deduplicated)
  const candidateModels = Array.from(
    new Set([primaryModel, ...fallbackModels].filter(Boolean))
  );

  const perAttemptTimeout =
    timeoutMs || parseInt(process.env.NVIDIA_TIMEOUT_MS, 10) || 15000;

  const baseUrl = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(
    /\/+$/,
    ""
  );
  const endpoint = `${baseUrl}/chat/completions`;

  let lastError = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const currentModel = candidateModels[i];
    const isLastCandidate = i === candidateModels.length - 1;

    try {
      const result = await executeSingleChatRequest({
        model: currentModel,
        endpoint,
        apiKey,
        messages,
        temperature,
        maxTokens,
        responseFormat,
        timeoutMs: perAttemptTimeout,
      });

      if (i > 0) {
        console.log(
          `✅ [NVIDIA NIM] Successfully recovered request using fallback model: "${currentModel}".`
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      // Bad credentials shouldn't cycle through models
      if (error.statusCode === 401) {
        throw error;
      }

      if (!isLastCandidate) {
        const nextModel = candidateModels[i + 1];
        console.warn(
          `⚠️ [NVIDIA NIM] Primary model "${currentModel}" failed (${error.message}). Automatically falling back to "${nextModel}"...`
        );
      } else {
        console.error(
          `❌ [NVIDIA NIM] All candidate models (${candidateModels.join(
            ", "
          )}) failed. Final error: ${error.message}`
        );
      }
    }
  }

  throw lastError;
};
