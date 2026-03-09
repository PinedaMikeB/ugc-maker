import { prepareGeneratorInput } from "../../lib/analyzer.mjs";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const result = await prepareGeneratorInput({
      source: body.source,
      productDetails: body.productDetails,
      audioMode: body.audioMode,
      voiceScript: body.voiceScript,
      uploadedFileNames: body.uploadedFileNames || [],
      analysis: body.analysis || null,
      enhanceImages: Boolean(body.enhanceImages),
      removeBackground: Boolean(body.removeBackground),
    });
    return json(200, result);
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Generator prep failed",
    });
  }
}
