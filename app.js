const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");
let lastAnalysisPayload = null;

const analyzeForm = document.getElementById("analyze-form");
const analyzeWorkspace = document.getElementById("analyze-workspace");
const analyzeSummary = document.getElementById("analysis-summary");
const sendToCreateButton = document.getElementById("send-to-create");

const createForm = document.getElementById("create-form");
const createWorkspace = document.getElementById("create-workspace");
const createSummary = document.getElementById("create-summary");
const assetList = document.getElementById("asset-list");
const analyzeButton = analyzeForm.querySelector('button[type="submit"]');
const createButton = createForm.querySelector('button[type="submit"]');
const generatedScript = document.getElementById("generated-script");
const generatedScenes = document.getElementById("generated-scenes");
const generatedAssets = document.getElementById("generated-assets");
const generatedRenderNotes = document.getElementById("generated-render-notes");

function activateTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tabName}-panel`);
  });
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

function renderSummary(root, entries) {
  root.innerHTML = entries
    .filter((entry) => entry.value)
    .map(
      (entry) => `
        <article class="summary-card">
          <span>${entry.label}</span>
          <strong>${entry.value}</strong>
        </article>
      `
    )
    .join("");
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!contentType.includes("application/json")) {
    const condensed = text.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(`Server returned ${response.status}. ${condensed || "Non-JSON response."}`);
  }
  const payload = JSON.parse(text);
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

analyzeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = document.getElementById("analyze-url").value.trim();
  const file = document.getElementById("analyze-upload").files[0];
  const offer = document.getElementById("analyze-offer").value.trim();
  const heroProduct = document.getElementById("hero-product").value.trim();
  const customerPain = document.getElementById("customer-pain").value.trim();
  const creatorPersona = document.getElementById("creator-persona").value.trim();
  const website = document.getElementById("website-link").value.trim();

  if (!url && !file) {
    alert("Add a reference URL or upload a reference video first.");
    return;
  }

  if (file && !url) {
    alert("URL-based analysis is wired first. Upload-only analysis still needs the backend file pipeline.");
    return;
  }

  if (!heroProduct) {
    alert("Add the hero product first so the script stays specific.");
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "Analyzing...";

  try {
    const response = await fetch("/.netlify/functions/analyze-reference", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        referenceUrl: url,
        offer,
        heroProduct,
        customerPain,
        creatorPersona,
        websiteUrl: website,
      }),
    });
    const payload = await parseJsonResponse(response);

    lastAnalysisPayload = payload;

    renderSummary(analyzeSummary, [
      { label: "Reference", value: payload.reference?.title || url },
      { label: "Creator / Provider", value: [payload.reference?.creator, payload.reference?.provider].filter(Boolean).join(" · ") },
      { label: "Website", value: payload.website?.title || website },
      { label: "Hero Product", value: payload.heroProduct || heroProduct },
      { label: "Persona", value: payload.creatorPersona || creatorPersona },
      { label: "Analysis Type", value: payload.analysisType },
      { label: "Script Engine", value: payload.scriptEngine },
      { label: "Catalog Matches", value: payload.website?.productCount ? `${payload.website.productCount} products found` : "" },
      { label: "Website Status", value: payload.websiteError ? `Skipped: ${payload.websiteError}` : website ? "Fetched" : "" },
    ]);

    document.getElementById("reference-breakdown").value = payload.generated?.referenceBreakdown || "";
    document.getElementById("best-adaptation").value = payload.generated?.bestAdaptation || "";
    document.getElementById("execution-plan").value = payload.generated?.plan || "";
    document.getElementById("analysis-script").value = payload.generated?.script || "";
    document.getElementById("scene-plan").value = payload.generated?.scenes || "";

    analyzeWorkspace.classList.remove("hidden");
  } catch (error) {
    alert(error instanceof Error ? error.message : "Analysis failed");
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Analyze";
  }
});

sendToCreateButton.addEventListener("click", () => {
  const analysisScript = document.getElementById("analysis-script").value.trim();
  const analysisOffer = document.getElementById("analyze-offer").value.trim();
  const heroProduct = document.getElementById("hero-product").value.trim();
  if (analysisScript) {
    document.getElementById("voice-script").value = analysisScript;
  }
  if (!document.getElementById("create-products").value.trim()) {
    document.getElementById("create-products").value = [
      analysisOffer,
      heroProduct ? `Hero product: ${heroProduct}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  activateTab("create");
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const drivePath = document.getElementById("create-drive-path").value.trim();
  const productDetails = document.getElementById("create-products").value.trim();
  const files = [...document.getElementById("create-assets").files];
  const voiceUpload = document.getElementById("voice-upload").files[0];
  const audioMode =
    document.querySelector('input[name="audio-mode"]:checked')?.value || "regular-tts";
  const enhanceImages = document.getElementById("enhance-images").checked;
  const removeBackground = document.getElementById("remove-background").checked;
  const voiceScript = document.getElementById("voice-script").value.trim();

  createButton.disabled = true;
  createButton.textContent = "Preparing...";

  try {
    const response = await fetch("/.netlify/functions/prepare-generator", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: drivePath,
        productDetails,
        heroProduct: lastAnalysisPayload?.heroProduct || "",
        audioMode,
        voiceScript,
        uploadedFileNames: files.map((file) => file.name),
        analysis: lastAnalysisPayload,
        enhanceImages,
        removeBackground,
      }),
    });
    const payload = await parseJsonResponse(response);

    renderSummary(createSummary, [
      { label: "Drive / Source", value: drivePath },
      { label: "Product / Service", value: productDetails },
      { label: "Audio Mode", value: audioMode },
      { label: "Script Engine", value: payload.scriptEngine || lastAnalysisPayload?.scriptEngine || "heuristic" },
      { label: "Voice Upload", value: voiceUpload?.name || "" },
      { label: "Catalog Matches", value: payload.relevantProducts?.map((product) => product.name).join(" · ") || "" },
      {
        label: "Enhancements",
        value: [enhanceImages ? "enhance images" : "", removeBackground ? "remove background" : ""]
          .filter(Boolean)
          .join(" · "),
      },
    ]);

    assetList.innerHTML = files.length
      ? files
          .map(
            (file) => `
              <article class="asset-item">
                <strong>${file.name}</strong>
                <span>${file.type || "unknown type"} · ${Math.round(file.size / 1024)} KB</span>
              </article>
            `
          )
          .join("")
      : `<article class="asset-item"><strong>No uploaded files yet</strong><span>${payload.sourceAccess}</span></article>`;

    generatedScript.value = payload.generatorScript || "";
    generatedScenes.value = payload.shotPlan || "";
    generatedAssets.value = payload.assetChecklist || "";
    generatedRenderNotes.value = payload.renderPlan || "";

    if (!voiceScript && payload.generatorScript) {
      document.getElementById("voice-script").value = payload.generatorScript;
    }

    createWorkspace.classList.remove("hidden");
  } catch (error) {
    alert(error instanceof Error ? error.message : "Generator prep failed");
  } finally {
    createButton.disabled = false;
    createButton.textContent = "Prepare Generator";
  }
});
