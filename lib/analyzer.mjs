import OpenAI from "openai";

const MAX_HTML_CHARS = 120000;
const MAX_FIRESTORE_PRODUCTS = 120;
const FIRESTORE_PAGE_SIZE = 100;
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "your",
  "from",
  "that",
  "this",
  "into",
  "while",
  "about",
  "have",
  "want",
  "video",
  "short",
  "reels",
  "tiktok",
  "breadhub",
  "breads",
  "bread",
  "drinks",
  "various",
  "offers",
  "offer",
  "service",
  "product",
  "products",
  "style",
  "using",
  "show",
  "need",
  "make",
  "maker",
  "real",
  "fresh",
]);

let openAIClient = null;
const AI_TIMEOUT_MS = 15000;

function trim(value) {
  return String(value || "").trim();
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchMeta(html, attr, value) {
  const regex = new RegExp(
    `<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reverseRegex = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${value}["'][^>]*>`,
    "i"
  );
  return html.match(regex)?.[1] || html.match(reverseRegex)?.[1] || "";
}

function collectHeadings(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\\/${tagName}>`, "gi");
  const out = [];
  let match;
  while ((match = regex.exec(html))) {
    const text = stripTags(match[1]);
    if (text) out.push(text);
  }
  return [...new Set(out)].slice(0, 8);
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey });
  }
  return openAIClient;
}

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  };
}

function abortSignalWithTimeout(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

function extractJsonObject(text) {
  const raw = trim(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1] || raw.match(/```([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced.trim());
      } catch {
        return null;
      }
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeTextBlock(value) {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        let text = "";
        if (typeof item === "string") {
          text = trim(item);
        } else if (item && typeof item === "object") {
          const duration = trim(item.duration);
          const description = trim(item.description);
          text = [duration ? `(${duration})` : "", description].filter(Boolean).join(" ");
        } else {
          text = trim(JSON.stringify(item));
        }
        if (!text) return "";
        return /^\d+\./.test(text) || /^[-*]/.test(text) ? text : `${index + 1}. ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, entry]) => {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (char) => char.toUpperCase());
        return `${label}: ${normalizeTextBlock(entry)}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  return trim(typeof value === "string" ? value : "");
}

function normalizeAiAnalysis(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  return {
    referenceBreakdown: normalizeTextBlock(parsed.referenceBreakdown),
    bestAdaptation: normalizeTextBlock(parsed.bestAdaptation),
    plan: normalizeTextBlock(parsed.plan),
    script: normalizeTextBlock(parsed.script),
    scenes: normalizeTextBlock(parsed.scenes),
  };
}

function collectCategoryNames(html) {
  const names = [...html.matchAll(/name:\s*'([^']+)'/g)].map((match) => trim(match[1]));
  return [...new Set(names)].slice(0, 12);
}

function extractFirebaseConfig(html) {
  const block = html.match(/const\s+firebaseConfig\s*=\s*\{([\s\S]*?)\};/i)?.[1];
  if (!block) return null;

  const read = (key) =>
    block.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`, "i"))?.[1] || "";

  const config = {
    apiKey: read("apiKey"),
    projectId: read("projectId"),
  };

  return config.apiKey && config.projectId ? config : null;
}

function decodeFirestoreValue(node) {
  if (!node || typeof node !== "object") return null;
  if ("stringValue" in node) return node.stringValue;
  if ("integerValue" in node) return Number(node.integerValue);
  if ("doubleValue" in node) return Number(node.doubleValue);
  if ("booleanValue" in node) return Boolean(node.booleanValue);
  if ("timestampValue" in node) return node.timestampValue;
  if ("nullValue" in node) return null;
  if ("mapValue" in node) {
    const fields = node.mapValue.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
    );
  }
  if ("arrayValue" in node) {
    return (node.arrayValue.values || []).map((value) => decodeFirestoreValue(value));
  }
  return null;
}

function decodeFirestoreDocument(document) {
  const fields = document?.fields || {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}

function simplifyProduct(product) {
  return {
    name: trim(product.name),
    category: trim(product.category),
    mainCategory: trim(product.mainCategory),
    description: trim(product.shop?.description || product.description),
    imageUrl: trim(product.shop?.imageUrl),
    price: Number(product.finalSRP || 0),
    isEnabled: product.isEnabled !== false,
    isPublished: product.isPublished !== false,
    showOnWebsite: product.showOnWebsite !== false,
  };
}

async function fetchFirestoreProducts(config) {
  if (!config?.projectId || !config?.apiKey) return [];

  const products = [];
  let pageToken = "";

  while (products.length < MAX_FIRESTORE_PRODUCTS) {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/products`
    );
    url.searchParams.set("pageSize", String(FIRESTORE_PAGE_SIZE));
    url.searchParams.set("key", config.apiKey);
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Firestore product fetch failed (${response.status})`);
    }

    const payload = await response.json();
    const batch = (payload.documents || [])
      .map((document) => simplifyProduct(decodeFirestoreDocument(document)))
      .filter((product) => product.name);

    products.push(...batch);

    pageToken = payload.nextPageToken || "";
    if (!pageToken || batch.length === 0) {
      break;
    }
  }

  return products.slice(0, MAX_FIRESTORE_PRODUCTS);
}

function extractWebsiteData(html, websiteUrl) {
  const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || "";
  const description =
    matchMeta(html, "name", "description") ||
    matchMeta(html, "property", "og:description") ||
    "";
  const ogTitle = matchMeta(html, "property", "og:title");
  const h1s = collectHeadings(html, "h1");
  const h2s = collectHeadings(html, "h2");
  const text = stripTags(html).slice(0, 4000);

  return {
    url: websiteUrl,
    title: ogTitle || title,
    description,
    h1s,
    h2s,
    text,
    categoryNames: collectCategoryNames(html),
    firebaseConfig: extractFirebaseConfig(html),
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`Website fetch failed (${response.status})`);
  }
  return (await response.text()).slice(0, MAX_HTML_CHARS);
}

async function analyzeReferenceUrl(referenceUrl) {
  if (!referenceUrl) {
    return {
      provider: "",
      title: "",
      creator: "",
      description: "",
      hashtags: [],
      audio: "",
    };
  }

  const url = new URL(referenceUrl);
  const provider = url.hostname.replace(/^www\./, "");

  if (provider.includes("tiktok.com")) {
    try {
      const oembed = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(referenceUrl)}`
      );
      if (!oembed.ok) {
        throw new Error(`TikTok oEmbed failed (${oembed.status})`);
      }
      const data = await oembed.json();
      const description = trim(data.title);
      return {
        provider: "TikTok",
        title: description,
        creator: trim(data.author_name),
        description,
        hashtags: [...description.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((match) => match[1]),
        audio: description.match(/♬\s*(.+)$/)?.[1] || "",
      };
    } catch {
      return {
        provider: "TikTok",
        title: "",
        creator: "",
        description: "",
        hashtags: [],
        audio: "",
      };
    }
  }

  return {
    provider,
    title: "",
    creator: "",
    description: "",
    hashtags: [],
    audio: "",
  };
}

function isLikelySocialWebsite(urlValue) {
  try {
    const hostname = new URL(urlValue).hostname.replace(/^www\./, "").toLowerCase();
    return [
      "tiktok.com",
      "instagram.com",
      "youtube.com",
      "youtu.be",
      "facebook.com",
      "x.com",
      "twitter.com",
    ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function detectDomain(offer, website) {
  const hay = `${offer} ${website?.title || ""} ${website?.description || ""} ${website?.h1s?.join(" ") || ""} ${website?.h2s?.join(" ") || ""} ${website?.products?.map((item) => item.name).join(" ") || ""}`.toLowerCase();
  if (/(bread|donut|pastry|bakery|dessert|coffee|snack|food|cinnamon|cheese)/.test(hay)) {
    return "food";
  }
  if (/(service|agency|consult|software|app|saas|automation)/.test(hay)) {
    return "service";
  }
  return "general";
}

function inferWebsiteProductLines(website) {
  if (!website) return [];
  if (website.products?.length) {
    return website.products
      .slice(0, 8)
      .map((product) =>
        [product.name, product.category ? `(${product.category})` : "", product.price ? `PHP ${product.price}` : ""]
          .filter(Boolean)
          .join(" ")
      );
  }
  const pool = [...website.h1s, ...website.h2s, ...(website.categoryNames || []), ...website.text.split(/[.]/)];
  const cleaned = pool
    .map((item) => trim(item))
    .filter(Boolean)
    .filter((item) => item.length <= 80)
    .filter((item) => !/^home|about|contact|menu|shop$/i.test(item));
  return [...new Set(cleaned)].slice(0, 6);
}

function tokenizeKeywords(...values) {
  return [...new Set(
    values
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  )];
}

function scoreProduct(product, heroText, offerText, offerKeywords, referenceKeywords) {
  const hay = `${product.name} ${product.category} ${product.mainCategory} ${product.description}`.toLowerCase();
  const normalizedName = product.name.toLowerCase().replace(/\s+/g, " ").trim();
  let score = 0;
  if (heroText) {
    if (heroText.includes(normalizedName)) {
      score += 80;
    }
    const heroWords = normalizedName.split(" ").filter((part) => part.length >= 4);
    for (const word of heroWords) {
      if (heroText.includes(word)) {
        score += 14;
      }
    }
  }
  if (offerText) {
    if (offerText.includes(normalizedName)) {
      score += 40;
    }
    const nameParts = normalizedName.split(" ").filter((part) => part.length >= 4);
    if (nameParts.length >= 2) {
      for (let index = 0; index < nameParts.length - 1; index += 1) {
        const pair = `${nameParts[index]} ${nameParts[index + 1]}`;
        if (offerText.includes(pair)) {
          score += 18;
        }
      }
    }
  }
  for (const keyword of offerKeywords) {
    if (product.name.toLowerCase().includes(keyword)) {
      score += 10;
    } else if (hay.includes(keyword)) {
      score += 4;
    }
  }
  for (const keyword of referenceKeywords) {
    if (offerKeywords.includes(keyword)) continue;
    if (product.name.toLowerCase().includes(keyword)) {
      score += 2;
    } else if (hay.includes(keyword)) {
      score += 1;
    }
  }
  if (product.isEnabled) score += 2;
  if (product.showOnWebsite) score += 1;
  if (product.isPublished) score += 1;
  if (product.price > 0) score += 1;
  return score;
}

function pickRelevantProducts({ offer, heroProduct, reference, website }) {
  const products = website?.products || [];
  if (!products.length) return [];

  const heroText = trim(heroProduct).toLowerCase();
  const offerText = trim(offer).toLowerCase();
  const offerKeywords = tokenizeKeywords(offer);
  const referenceKeywords = offerKeywords.length
    ? tokenizeKeywords(reference?.title || "", reference?.description || "")
    : [];
  const ranked = products
    .map((product) => ({
      ...product,
      _score: scoreProduct(product, heroText, offerText, offerKeywords, referenceKeywords),
    }))
    .sort((left, right) => right._score - left._score || left.name.localeCompare(right.name));

  const relevant = ranked.filter((product) => product._score > 0).slice(0, 4);
  if (relevant.length) {
    return relevant;
  }

  return ranked.slice(0, 4);
}

function formatPrice(product) {
  return product?.price ? `PHP ${product.price}` : "";
}

function inferBrandPhrase(offer) {
  const cleanOffer = trim(offer);
  if (!cleanOffer) return "from your bakery";
  const match = cleanOffer.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/);
  if (match) {
    return `from ${match[1]}`;
  }
  if (/breadhub/i.test(cleanOffer)) {
    return "from BreadHub";
  }
  return "from your bakery";
}

function inferPainPoint(products, offer) {
  const hay = `${products.map((product) => product.name).join(" ")} ${offer}`.toLowerCase();
  if (/coffee|bun|bread|cinnamon|sweet|dessert|pastry/.test(hay)) {
    return "that late-afternoon moment when you need something comforting, not just another random snack";
  }
  if (/savory|ham|cheese|chicken/.test(hay)) {
    return "those days when you want something filling but do not want a full heavy meal";
  }
  return "the small everyday craving that makes people want a quick reward";
}

function defaultCreatorPersona() {
  return "Jolly, funny vlogger. Eager, full of energy and excitement. Sounds natural, relatable, playful, and expressive.";
}

function formatPainPointText(value) {
  const clean = trim(value).replace(/[.!?]+$/g, "");
  if (!clean) return "";
  const normalized = clean.charAt(0).toLowerCase() + clean.slice(1);
  if (/^(that|those|when|how)/i.test(normalized)) {
    return normalized;
  }
  return `when ${normalized}`;
}

function buildFoodScript(products, offer, heroProduct, customerPain) {
  const primary = products[0];
  const secondary = products[1];
  const third = products[2];
  const productLead = heroProduct || primary?.name || "your hero product";
  const secondaryLead = secondary?.name || "a second flavor";
  const thirdLead = third?.name || "another variation";
  const primaryPrice = formatPrice(primary);
  const brandPhrase = inferBrandPhrase(offer);
  const painPoint = formatPainPointText(customerPain) || inferPainPoint(products, offer);

  return [
    `Hook: You know ${painPoint}? ${productLead}${primaryPrice ? ` at ${primaryPrice}` : ""} feels like the kind of merienda you actually look forward to.`,
    `Body 1: Open on the strongest close-up first, then show the swirl, filling, or drizzle so the product proves itself immediately.`,
    `Body 2: Make it feel real by following with ${secondaryLead}${third ? ` and ${thirdLead}` : ""}, like a friend showing what else looked good at the counter instead of hard-selling.`,
    `CTA: Close with a soft invite to try it fresh today ${brandPhrase}.`,
  ].join("\n");
}

function buildFoodAnalysisFallback({ offer, heroProduct, customerPain, website, reference }) {
  const websiteLines = inferWebsiteProductLines(website);
  const relevantProducts = pickRelevantProducts({ offer, heroProduct, reference, website });
  const productLine = relevantProducts
    .map((product) => `${product.name}${formatPrice(product) ? ` (${formatPrice(product)})` : ""}`)
    .join(", ");
  const referenceBreakdown = [
    `Hook pattern: open with a relatable craving or tired-after-a-long-day moment, then reveal the product immediately.`,
    `Visual strength: food texture does the selling, so the strongest close-up must happen before any long explanation.`,
    `Emotional connection: the reference works when it feels like a friend casually sharing something that genuinely made their day better.`,
    `Best practices to keep: fast opening payoff, close-up proof, playful conversational voice, and a soft recommendation instead of a hard sell.`,
    `What to avoid: corporate copy, generic bakery claims, or listing too many products before the hero item gets its moment.`,
  ].join("\n");
  const bestAdaptation = [
    `Use the reference as a craving-first product reveal, not as a literal copy.`,
    `For your offer, the best adaptation is a short vertical food ad built around ${heroProduct || relevantProducts[0]?.name || "one clear hero product"}, then follows with texture proof and a soft recommendation.`,
    website?.title ? `The website context points to "${website.title}" as the brand frame for the adaptation.` : "",
    customerPain ? `Anchor the script around this customer moment: ${customerPain}` : "",
    productLine ? `Best-matching products found from your catalog: ${productLine}.` : "",
    websiteLines.length ? `Possible product lines pulled from the website: ${websiteLines.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const plan = [
    `1. Open on ${heroProduct || relevantProducts[0]?.name || "the most desirable product"} in the first two seconds.`,
    "2. Follow immediately with filling, topping, drizzle, crumb, or close-up texture proof.",
    `3. Introduce ${relevantProducts[1]?.name || "one more product variation"} so the offer feels like a lineup instead of a single SKU.`,
    `4. Close with a soft ${website?.title?.includes("BreadHub") ? "BreadHub-style" : "brand-led"} recommendation and freshness cue.`,
    website?.url ? `5. Pull product naming and flavor wording from ${website.url} so the script stays brand-consistent.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const script = buildFoodScript(
    relevantProducts,
    trim(offer) || "your bakery line",
    trim(heroProduct),
    trim(customerPain)
  );

  const scenes = [
    `Scene 1: ${heroProduct || relevantProducts[0]?.name || "strongest hero product"} in the first 2 seconds.`,
    `Scene 2: extreme close-up of ${heroProduct || relevantProducts[0]?.name || "the hero item"} texture, filling, drizzle, or crumb.`,
    `Scene 3: ${relevantProducts[1]?.name || "second flavor"} for lineup proof.`,
    `Scene 4: ${relevantProducts[2]?.name || "third variation"}, packaging, tray, store counter, or hand-held pickup shot.`,
    "Scene 5: soft CTA with brand name, product names, and freshness message.",
  ].join("\n");

  return { referenceBreakdown, bestAdaptation, plan, script, scenes, relevantProducts };
}

function buildServiceAnalysis({ offer, website }) {
  const bestAdaptation = [
    "Use the reference for pacing and hook structure, not food-style craving visuals.",
    `For your offer, the best adaptation is a pain-point to payoff short-form ad for ${trim(offer) || "your service"}.`,
    website?.title ? `The website title "${website.title}" should anchor the wording and offer framing.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const plan = [
    "1. Open with the result or transformation first.",
    "2. Show the problem quickly.",
    "3. Present the service or workflow as the relief point.",
    "4. End with a direct CTA to learn more or book.",
  ].join("\n");

  const script = [
    `This reference should be adapted into a fast transformation-style ad for ${trim(offer) || "your service"}.`,
    "Lead with the result the client wants, then quickly explain the problem and how the service fixes it.",
    "Keep the CTA direct and benefit-led.",
  ].join(" ");

  const scenes = [
    "Scene 1: result or payoff statement.",
    "Scene 2: problem or frustration frame.",
    "Scene 3: service/process explanation.",
    "Scene 4: offer and CTA.",
  ].join("\n");

  return { bestAdaptation, plan, script, scenes };
}

async function maybeGenerateFoodAnalysisWithAI({
  offer,
  heroProduct,
  customerPain,
  creatorPersona,
  website,
  reference,
  fallback,
}) {
  const relevantProducts = (fallback.relevantProducts || []).map((product) => ({
    name: product.name,
    category: product.category,
    price: product.price,
    description: trim(product.description).slice(0, 220),
  }));

  const prompt = [
    "Analyze the reference video first, then adapt it into a UGC bakery promo.",
    "Return strict JSON with keys: referenceBreakdown, bestAdaptation, plan, script, scenes.",
    "Every value must be a plain string. Do not return nested objects or arrays.",
    "Keep each field compact and high-signal.",
    "referenceBreakdown must explain: hook pattern, pacing/structure, visual proof strategy, emotional connection, humor/energy style, and repeatable best practices.",
    "bestAdaptation must explain how to apply the reference strengths to the user's actual product in 3 to 5 sentences.",
    "plan must be a beat-by-beat production plan with sequence, tone, and B-roll logic in 5 to 7 lines.",
    "script must sound like a real person, not ad copy.",
    "Use emotional connection, relatable pain points, and everyday situations.",
    "The speaker personality must strongly match the requested creator persona.",
    "The voice should feel like a jolly, funny, eager, energetic vlogger when that persona is requested.",
    "Avoid fake hype, avoid corporate wording, avoid exaggerated marketing language that feels unnatural.",
    "Use the actual product names provided. Mention prices only if natural.",
    "Write in warm, natural Filipino-English friendly tone.",
    "Make the script detailed, vivid, and performance-ready. Aim for roughly 120 to 170 words.",
    "scenes must be actionable, with concrete shot ideas and B-roll guidance in 5 lines.",
    "",
    `Offer: ${offer || "Bakery products"}`,
    `Hero product: ${heroProduct || ""}`,
    `Customer pain point: ${customerPain || ""}`,
    `Creator persona: ${creatorPersona || defaultCreatorPersona()}`,
    `Reference title: ${reference?.title || ""}`,
    `Reference creator: ${reference?.creator || ""}`,
    `Website title: ${website?.title || ""}`,
    `Website description: ${website?.description || ""}`,
    `Relevant products: ${JSON.stringify(relevantProducts)}`,
    `Fallback best adaptation: ${fallback.bestAdaptation}`,
    `Fallback plan: ${fallback.plan}`,
    `Fallback script: ${fallback.script}`,
    `Fallback scenes: ${fallback.scenes}`,
  ].join("\n");

  const gemini = getGeminiConfig();
  if (gemini) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          gemini.model
        )}:generateContent?key=${encodeURIComponent(gemini.apiKey)}`,
        {
          method: "POST",
          signal: abortSignalWithTimeout(AI_TIMEOUT_MS),
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: "You are a senior UGC script strategist for local food brands. Return JSON only.",
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1200,
              responseMimeType: "application/json",
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          }),
        }
      );
      if (response.ok) {
        const payload = await response.json();
        const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
        const parsed = normalizeAiAnalysis(extractJsonObject(text));
        if (
          parsed &&
          trim(parsed.referenceBreakdown) &&
          trim(parsed.bestAdaptation) &&
          trim(parsed.plan) &&
          trim(parsed.script) &&
          trim(parsed.scenes)
        ) {
          return {
            provider: "gemini",
            output: parsed,
          };
        }
      }
    } catch {
      // fall through to other providers
    }
  }

  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      instructions: "You are a senior UGC script strategist for local food brands. Return JSON only.",
      input: prompt,
      max_output_tokens: 1200,
    });
    const parsed = normalizeAiAnalysis(extractJsonObject(response.output_text || ""));
    if (
      parsed &&
      trim(parsed.referenceBreakdown) &&
      trim(parsed.bestAdaptation) &&
      trim(parsed.plan) &&
      trim(parsed.script) &&
      trim(parsed.scenes)
    ) {
      return {
        provider: "openai",
        output: parsed,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function analyzeInput({
  referenceUrl,
  offer,
  heroProduct,
  customerPain,
  creatorPersona,
  websiteUrl,
}) {
  const cleanReferenceUrl = trim(referenceUrl);
  const cleanOffer = trim(offer);
  const cleanHeroProduct = trim(heroProduct);
  const cleanCustomerPain = trim(customerPain);
  const cleanCreatorPersona = trim(creatorPersona) || defaultCreatorPersona();
  const cleanWebsiteUrl = trim(websiteUrl);

  const reference = await analyzeReferenceUrl(cleanReferenceUrl);
  let website = null;
  let websiteError = "";
  if (cleanWebsiteUrl && !isLikelySocialWebsite(cleanWebsiteUrl)) {
    try {
      const html = await fetchHtml(cleanWebsiteUrl);
      website = extractWebsiteData(html, cleanWebsiteUrl);
      if (website.firebaseConfig) {
        const firestoreProducts = await fetchFirestoreProducts(website.firebaseConfig);
        website.products = firestoreProducts.filter(
          (product) => product.isEnabled !== false && product.showOnWebsite !== false
        );
      }
    } catch (error) {
      websiteError = error instanceof Error ? error.message : "Website fetch failed";
    }
  }

  const domain = detectDomain(cleanOffer, website);
  let generated;
  let scriptEngine = "heuristic";
  if (domain === "food") {
    const fallback = buildFoodAnalysisFallback({
      offer: cleanOffer,
      heroProduct: cleanHeroProduct,
      customerPain: cleanCustomerPain,
      website,
      reference,
    });
    const aiGenerated = await maybeGenerateFoodAnalysisWithAI({
      offer: cleanOffer,
      heroProduct: cleanHeroProduct,
      customerPain: cleanCustomerPain,
      creatorPersona: cleanCreatorPersona,
      website,
      reference,
      fallback,
    });
    generated = aiGenerated ? { ...fallback, ...aiGenerated.output } : fallback;
    if (aiGenerated) {
      scriptEngine = aiGenerated.provider;
    }
  } else {
    generated = buildServiceAnalysis({ offer: cleanOffer, website, reference });
  }

  return {
    reference,
    website: website
      ? {
          ...website,
          firebaseConfig: undefined,
          products: (website.products || []).slice(0, 12),
          productCount: website.products?.length || 0,
        }
      : null,
    websiteError,
    generated,
    analysisType: domain,
    scriptEngine,
    heroProduct: cleanHeroProduct,
    customerPain: cleanCustomerPain,
    creatorPersona: cleanCreatorPersona,
  };
}

function detectSourceAccess(source, uploadedFileNames) {
  const trimmedSource = trim(source);
  if (uploadedFileNames.length) {
    return `Using ${uploadedFileNames.length} uploaded asset${uploadedFileNames.length === 1 ? "" : "s"} from the browser.`;
  }
  if (!trimmedSource) {
    return "No product assets uploaded yet. Add files or a reachable media source before rendering.";
  }
  if (/drive\.google\.com/i.test(trimmedSource)) {
    return "Google Drive source saved, but the public Netlify app cannot inspect a private Drive folder yet. Upload the media here or run the local worker for Drive ingest.";
  }
  if (/^https?:\/\//i.test(trimmedSource)) {
    return "URL source saved as a reference, but direct media collection from public URLs is not wired yet.";
  }
  return "Local path saved as a source note. The deployed app cannot read local machine paths directly.";
}

export async function prepareGeneratorInput({
  source,
  productDetails,
  heroProduct,
  audioMode,
  voiceScript,
  uploadedFileNames = [],
  analysis = null,
  enhanceImages = false,
  removeBackground = false,
}) {
  const cleanDetails = trim(productDetails);
  const relevantProducts =
    analysis?.generated?.relevantProducts?.length
      ? analysis.generated.relevantProducts.slice(0, 4)
      : pickRelevantProducts({
          offer: cleanDetails,
          heroProduct,
          reference: analysis?.reference || {},
          website: analysis?.website || {},
        });
  const sourceAccess = detectSourceAccess(source, uploadedFileNames);
  const fallbackScript = buildFoodScript(
    relevantProducts,
    cleanDetails || "your bakery line",
    trim(heroProduct),
    analysis?.customerPain || ""
  );
  const generatorScript =
    trim(voiceScript) ||
    trim(analysis?.generated?.script) ||
    fallbackScript;

  const shotPlan = [
    `Shot 1: ${relevantProducts[0]?.name || "hero product"} as the opening payoff shot.`,
    `Shot 2: close-up texture proof for ${relevantProducts[0]?.name || "the hero product"}.`,
    `Shot 3: ${relevantProducts[1]?.name || "a second product"} to expand the lineup.`,
    "Shot 4: hand-held, tray, counter, or packaging shot for context.",
    "Shot 5: closing title card or soft CTA frame.",
  ].join("\n");

  const assetChecklist = [
    `${relevantProducts[0]?.name || "Hero product"} close-up photo or clip`,
    `${relevantProducts[0]?.name || "Hero product"} texture detail shot`,
    `${relevantProducts[1]?.name || "Second variation"} photo or clip`,
    "Packaging or counter shot",
    "Logo or brand ending frame",
  ].join("\n");

  const renderPlan = [
    `Audio mode: ${audioMode || "regular-tts"}.`,
    `Script engine: ${analysis?.scriptEngine || "heuristic"}.`,
    enhanceImages ? "Image enhancement requested before stitching." : "No image enhancement requested.",
    removeBackground ? "Background removal requested where possible." : "Background removal not requested.",
    sourceAccess,
  ].join("\n");

  return {
    sourceAccess,
    generatorScript,
    shotPlan,
    assetChecklist,
    renderPlan,
    relevantProducts: relevantProducts.slice(0, 4),
    scriptEngine: analysis?.scriptEngine || "heuristic",
  };
}
