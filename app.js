const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

const analyzeForm = document.getElementById("analyze-form");
const analyzeWorkspace = document.getElementById("analyze-workspace");
const analyzeSummary = document.getElementById("analysis-summary");
const sendToCreateButton = document.getElementById("send-to-create");

const createForm = document.getElementById("create-form");
const createWorkspace = document.getElementById("create-workspace");
const createSummary = document.getElementById("create-summary");
const assetList = document.getElementById("asset-list");

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

analyzeForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const url = document.getElementById("analyze-url").value.trim();
  const file = document.getElementById("analyze-upload").files[0];
  const offer = document.getElementById("analyze-offer").value.trim();
  const website = document.getElementById("website-link").value.trim();

  renderSummary(analyzeSummary, [
    { label: "Reference URL", value: url },
    { label: "Uploaded Video", value: file?.name || "" },
    { label: "Offer / Product", value: offer },
    { label: "Website", value: website },
  ]);

  analyzeWorkspace.classList.remove("hidden");
});

sendToCreateButton.addEventListener("click", () => {
  const analysisScript = document.getElementById("analysis-script").value.trim();
  if (analysisScript) {
    document.getElementById("voice-script").value = analysisScript;
  }
  activateTab("create");
});

createForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const drivePath = document.getElementById("create-drive-path").value.trim();
  const productDetails = document.getElementById("create-products").value.trim();
  const files = [...document.getElementById("create-assets").files];
  const voiceUpload = document.getElementById("voice-upload").files[0];
  const audioMode =
    document.querySelector('input[name="audio-mode"]:checked')?.value || "regular-tts";
  const enhanceImages = document.getElementById("enhance-images").checked;
  const removeBackground = document.getElementById("remove-background").checked;

  renderSummary(createSummary, [
    { label: "Drive / Source", value: drivePath },
    { label: "Product / Service", value: productDetails },
    { label: "Audio Mode", value: audioMode },
    { label: "Voice Upload", value: voiceUpload?.name || "" },
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
    : `<article class="asset-item"><strong>No uploaded files yet</strong><span>Add images or clips to continue.</span></article>`;

  createWorkspace.classList.remove("hidden");
});
