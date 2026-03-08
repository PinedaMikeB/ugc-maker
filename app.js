const state = {
  activeTab: "analyze",
  reference: {
    title: "Milky cheese donuts for my man",
    creator: "@tineydc",
    source: "TikTok reference",
    duration: "30 sec",
    format: "1080x1920 vertical",
    style: "Fast food reveal",
    confidence: "Likely drivers, not certainty",
  },
  insights: [
    {
      label: "Hook Pattern",
      value: "Food result shown early",
      note: "The payoff appears immediately instead of waiting for a long setup.",
    },
    {
      label: "Pacing",
      value: "Quick cut rhythm",
      note: "Every beat feels disposable and easy to watch again.",
    },
    {
      label: "Visual Trigger",
      value: "Texture close-ups",
      note: "The product surface and filling do the selling, not a long explanation.",
    },
    {
      label: "Caption Style",
      value: "Simple, readable, direct",
      note: "The text supports the craving instead of competing with the frame.",
    },
    {
      label: "CTA Style",
      value: "Soft recommendation",
      note: "It feels like a casual share, not a hard ad.",
    },
    {
      label: "Replicable Angle",
      value: "Pick 1 sensory promise",
      note: "For BreadHub, that should be softness, drizzle, or filling reveal.",
    },
  ],
  checklist: [
    {
      title: "Confirm the hook really appears in the first 2 seconds",
      done: true,
    },
    {
      title: "Check if the text is readable without sound",
      done: true,
    },
    {
      title: "Decide which food reveal should become the template anchor",
      done: true,
    },
    {
      title: "Replace generic wording with BreadHub-specific product language",
      done: false,
    },
    {
      title: "Approve final template before auto-generation",
      done: false,
    },
  ],
  template: {
    name: "Fast Craving Food Reveal",
    tone: "Warm, casual, sensory",
    scenes: [
      {
        step: "Scene 1",
        title: "Immediate payoff",
        detail: "Open on the strongest product visual before any setup line.",
      },
      {
        step: "Scene 2",
        title: "Texture proof",
        detail: "Tight crop of filling, drizzle, or crumb to prove desirability.",
      },
      {
        step: "Scene 3",
        title: "Variation or second flavor",
        detail: "Show product variety so the line feels bigger than one item.",
      },
      {
        step: "Scene 4",
        title: "Soft CTA",
        detail: "Close with a low-pressure invite to try it fresh at BreadHub.",
      },
    ],
  },
  draft: {
    product: "BreadHub Cinnamon Line",
    sourcePath: "/Work/Media/BreadHub/Cinnamons",
    status: "Preview rendered",
    templateName: "Fast Craving Food Reveal",
    sourceCount: 4,
    script: [
      "BreadHub just dropped a cinnamon lineup that looks premium but still feels like merienda.",
      "From the Biscoff cinnamon to the blueberry cinnamon and that cinnamon drizzle finish, every piece looks made for a quick crave post.",
      "If you want soft, sweet, and easy to recommend, this is the kind of BreadHub drop worth trying while it is fresh.",
    ].join(" "),
    scenes: [
      {
        title: "BreadHub Cinnamon Drop",
        visual: "Store/product opener",
        reason: "Sets context fast and tells the viewer this is a fresh bakery release.",
      },
      {
        title: "Biscoff Cinnamon",
        visual: "Heavy topping close-up",
        reason: "Strongest indulgence frame, useful for stop-the-scroll value.",
      },
      {
        title: "Blueberry Cinnamon",
        visual: "Flavor variation",
        reason: "Shows range so the post feels like a product line, not a single SKU.",
      },
      {
        title: "Cinnamon Drizzle",
        visual: "Sticky finish close-up",
        reason: "Ends on the most sensory image for recall.",
      },
    ],
    assets: [
      "647056595_1494946395523656_7710617307308884484_n.jpg",
      "Biscoff Cinnamon.png",
      "Blueberry cinnamon.png",
      "Cinnamon Drizzle.png",
    ],
  },
  templates: [
    {
      name: "Fast Craving Food Reveal",
      source: "TikTok food reference",
      fit: "Best for product-only image packs",
      note: "Short, sensory, no fake influencer acting yet.",
    },
    {
      name: "Store Visit Mini Vlog",
      source: "Manual concept",
      fit: "Best once you upload real clips from the bakery",
      note: "Needs actual cashier, tray, and bite footage to feel believable.",
    },
    {
      name: "Flavor Lineup Carousel Video",
      source: "Current cinnamon build",
      fit: "Best for launching multiple variants in one post",
      note: "Good for breads, donuts, and seasonal drops.",
    },
  ],
  queue: [
    {
      title: "BreadHub Cinnamon V2",
      status: "Needs better hook copy",
      note: "Decide whether to lead with Biscoff or drizzle.",
    },
    {
      title: "Subtitle pass",
      status: "Pending manual approval",
      note: "Text timing should match the voiceover before automation.",
    },
    {
      title: "Reference analyzer upgrade",
      status: "Later",
      note: "Turn manual notes into auto-detected structure after V1 works.",
    },
  ],
};

const heroStatsRoot = document.getElementById("hero-stats");
const referenceCardRoot = document.getElementById("reference-card");
const confidenceRoot = document.getElementById("reference-confidence");
const insightGridRoot = document.getElementById("insight-grid");
const checklistRoot = document.getElementById("checklist");
const templatePillRoot = document.getElementById("template-pill");
const templateStackRoot = document.getElementById("template-stack");
const draftMetaRoot = document.getElementById("draft-meta");
const sceneListRoot = document.getElementById("scene-list");
const scriptDraftRoot = document.getElementById("script-draft");
const assetListRoot = document.getElementById("asset-list");
const libraryGridRoot = document.getElementById("library-grid");
const queueRoot = document.getElementById("queue-list");

function renderHeroStats() {
  const stats = [
    { label: "Reference Format", value: state.reference.format },
    { label: "Current Output", value: "1 real cinnamon preview" },
    { label: "Workflow", value: "Manual-first" },
    { label: "Next Gate", value: "Approve V2 direction" },
  ];

  heroStatsRoot.innerHTML = stats
    .map(
      (stat) => `
        <article class="metric-card">
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
        </article>
      `
    )
    .join("");
}

function renderReference() {
  referenceCardRoot.innerHTML = `
    <div class="reference-title">${state.reference.title}</div>
    <div class="reference-meta">${state.reference.creator} · ${state.reference.source}</div>
    <div class="reference-meta">${state.reference.duration} · ${state.reference.style}</div>
    <div class="tag-row">
      <span class="tag">${state.reference.format}</span>
      <span class="tag">Food niche</span>
      <span class="tag">Craving-first</span>
    </div>
  `;
  confidenceRoot.textContent = state.reference.confidence;
}

function renderInsights() {
  insightGridRoot.innerHTML = state.insights
    .map(
      (item) => `
        <article class="insight-card">
          <span class="insight-label">${item.label}</span>
          <strong>${item.value}</strong>
          <p>${item.note}</p>
        </article>
      `
    )
    .join("");
}

function renderChecklist() {
  checklistRoot.innerHTML = state.checklist
    .map(
      (item) => `
        <label class="check-item">
          <input type="checkbox" ${item.done ? "checked" : ""} />
          <span>${item.title}</span>
        </label>
      `
    )
    .join("");
}

function renderTemplate() {
  templatePillRoot.textContent = state.template.name;
  templateStackRoot.innerHTML = state.template.scenes
    .map(
      (scene) => `
        <article class="template-card">
          <span class="template-step">${scene.step}</span>
          <strong>${scene.title}</strong>
          <p>${scene.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderDraft() {
  draftMetaRoot.innerHTML = `
    <div class="draft-chip">${state.draft.product}</div>
    <div class="draft-chip">${state.draft.templateName}</div>
    <div class="draft-chip">${state.draft.sourceCount} source images</div>
    <div class="draft-chip">${state.draft.status}</div>
    <p class="draft-path">Source path: ${state.draft.sourcePath}</p>
  `;

  sceneListRoot.innerHTML = state.draft.scenes
    .map(
      (scene, index) => `
        <article class="scene-card">
          <span class="scene-index">Scene ${index + 1}</span>
          <strong>${scene.title}</strong>
          <p><span>Visual:</span> ${scene.visual}</p>
          <p><span>Why:</span> ${scene.reason}</p>
        </article>
      `
    )
    .join("");

  scriptDraftRoot.value = state.draft.script;

  assetListRoot.innerHTML = state.draft.assets
    .map(
      (asset) => `
        <article class="asset-item">
          <strong>${asset}</strong>
          <span>Used in current cinnamon preview</span>
        </article>
      `
    )
    .join("");
}

function renderTemplates() {
  libraryGridRoot.innerHTML = state.templates
    .map(
      (template) => `
        <article class="library-card">
          <div class="section-mini">${template.source}</div>
          <strong>${template.name}</strong>
          <p>${template.fit}</p>
          <div class="library-note">${template.note}</div>
        </article>
      `
    )
    .join("");
}

function renderQueue() {
  queueRoot.innerHTML = state.queue
    .map(
      (item) => `
        <article class="queue-card">
          <header>
            <strong>${item.title}</strong>
            <span class="status-pill">${item.status}</span>
          </header>
          <p>${item.note}</p>
        </article>
      `
    )
    .join("");
}

function bindTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      document
        .querySelectorAll(".tab-button")
        .forEach((tab) => tab.classList.toggle("active", tab === button));
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `${state.activeTab}-panel`);
      });
    });
  });
}

function render() {
  renderHeroStats();
  renderReference();
  renderInsights();
  renderChecklist();
  renderTemplate();
  renderDraft();
  renderTemplates();
  renderQueue();
}

bindTabs();
render();
