import { analyzeInput } from "../../lib/analyzer.mjs";

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
    const result = await analyzeInput({
      referenceUrl: body.referenceUrl,
      offer: body.offer,
      heroProduct: body.heroProduct,
      customerPain: body.customerPain,
      creatorPersona: body.creatorPersona,
      websiteUrl: body.websiteUrl,
    });
    return json(200, result);
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Analysis failed",
    });
  }
}
