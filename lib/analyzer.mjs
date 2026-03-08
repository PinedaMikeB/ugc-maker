const MAX_HTML_CHARS = 120000;

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
  const hay = `${offer} ${website?.title || ""} ${website?.description || ""} ${website?.h1s?.join(" ") || ""} ${website?.h2s?.join(" ") || ""}`.toLowerCase();
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
  const pool = [...website.h1s, ...website.h2s, ...website.text.split(/[.]/)];
  const cleaned = pool
    .map((item) => trim(item))
    .filter(Boolean)
    .filter((item) => item.length <= 80)
    .filter((item) => !/^home|about|contact|menu|shop$/i.test(item));
  return [...new Set(cleaned)].slice(0, 6);
}

function buildFoodAnalysis({ offer, website, reference }) {
  const websiteLines = inferWebsiteProductLines(website);
  const bestAdaptation = [
    `Use the reference as a craving-first product reveal, not as a literal copy.`,
    `For your offer, the best adaptation is a short vertical food ad that opens with the strongest product payoff first, then follows with texture proof and a soft recommendation.`,
    website?.title ? `The website context points to "${website.title}" as the brand frame for the adaptation.` : "",
    websiteLines.length ? `Possible product lines pulled from the website: ${websiteLines.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const plan = [
    "1. Open on the most desirable product frame in the first two seconds.",
    "2. Follow immediately with filling, topping, drizzle, crumb, or close-up texture proof.",
    "3. Introduce one more product variation so the offer feels like a lineup instead of a single SKU.",
    "4. Close with a soft BreadHub-style recommendation and freshness cue.",
    website?.url ? `5. Pull product naming and flavor wording from ${website.url} so the script stays brand-consistent.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const script = [
    `This reference works best when adapted into a short crave-first product video for ${trim(offer) || "your product line"}.`,
    "Start with the strongest hero item right away.",
    "Then show the texture, filling, or topping close-up that proves why it is worth trying.",
    "Add one more variation so the line feels bigger and more exciting.",
    "End with a soft call to try it fresh or order it while it is available.",
  ].join(" ");

  const scenes = [
    "Scene 1: strongest hero product visual in the first 2 seconds.",
    "Scene 2: extreme close-up of texture, filling, drizzle, or crumb.",
    "Scene 3: second flavor or variation for lineup proof.",
    "Scene 4: packaging, tray, store counter, or hand-held pickup shot.",
    "Scene 5: soft CTA with brand/product name and freshness message.",
  ].join("\n");

  return { bestAdaptation, plan, script, scenes };
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

export async function analyzeInput({ referenceUrl, offer, websiteUrl }) {
  const cleanReferenceUrl = trim(referenceUrl);
  const cleanOffer = trim(offer);
  const cleanWebsiteUrl = trim(websiteUrl);

  const reference = await analyzeReferenceUrl(cleanReferenceUrl);
  let website = null;
  let websiteError = "";
  if (cleanWebsiteUrl && !isLikelySocialWebsite(cleanWebsiteUrl)) {
    try {
      const html = await fetchHtml(cleanWebsiteUrl);
      website = extractWebsiteData(html, cleanWebsiteUrl);
    } catch (error) {
      websiteError = error instanceof Error ? error.message : "Website fetch failed";
    }
  }

  const domain = detectDomain(cleanOffer, website);
  const generated =
    domain === "food"
      ? buildFoodAnalysis({ offer: cleanOffer, website, reference })
      : buildServiceAnalysis({ offer: cleanOffer, website, reference });

  return {
    reference,
    website,
    websiteError,
    generated,
    analysisType: domain,
  };
}
