const folders = [
  {
    id: "ube-cheese",
    name: "Ube Cheese Pandesal",
    folder: "2026-03-08-ube-cheese-pandesal",
    clips: 14,
    duration: "09:48 raw footage",
    notes: "Purple crumb, cheese pull, warm tray shots, counter ordering included.",
    status: "Ready to analyze",
    tone: "Playful, comforting",
    stagesDone: 1,
    tags: ["Storefront", "Order moment", "Cheese pull", "Reaction"],
    script: [
      {
        label: "Hook",
        text: "Guys, I just found the softest ube cheese pandesal and the inside is unreal.",
      },
      {
        label: "Arrival",
        text: "I walked into BreadHub and the trays were still warm, so I had to try this right away.",
      },
      {
        label: "Taste test",
        text: "The bread is fluffy, the ube is rich but not too sweet, and the cheese gives it that perfect salty finish.",
      },
      {
        label: "CTA",
        text: "If you pass by BreadHub, get this while it is fresh because this one disappears fast.",
      },
    ],
    shots: [
      {
        title: "Street-to-store hook",
        description: "Start with the storefront clip, cut on the door open, then snap to the warm tray reveal.",
        tag: "0-4 sec",
      },
      {
        title: "Order confirmation",
        description: "Use the cashier ordering exchange to make the vlog feel real and location-based.",
        tag: "5-11 sec",
      },
      {
        title: "Cheese pull proof",
        description: "Tight macro shot over the cheese stretch with emphasized subtitle keywords.",
        tag: "12-18 sec",
      },
      {
        title: "Reaction close",
        description: "End on the bite reaction with a price card and map pin CTA overlay.",
        tag: "19-26 sec",
      },
    ],
  },
  {
    id: "ensaymada",
    name: "Classic Ensaymada",
    folder: "2026-03-08-classic-ensaymada",
    clips: 11,
    duration: "07:31 raw footage",
    notes: "Sugar topping, butter spread close-ups, customer smile shot, shelf restock clip.",
    status: "Script drafted",
    tone: "Warm, indulgent",
    stagesDone: 3,
    tags: ["Butter spread", "Restock", "Smile reaction"],
    script: [
      {
        label: "Hook",
        text: "I came in for one bread and left obsessed with this buttery ensaymada.",
      },
      {
        label: "Context",
        text: "BreadHub had a fresh batch on the shelf and you can actually see the butter shine on top.",
      },
      {
        label: "Taste test",
        text: "It is soft, milky, and rich without feeling heavy, so this is easy to finish in one sitting.",
      },
      {
        label: "CTA",
        text: "If you like classic bakery comfort food, this should be on your next BreadHub run.",
      },
    ],
    shots: [
      {
        title: "Shelf restock opener",
        description: "Lead with the shelf refill to create urgency and make the batch feel fresh.",
        tag: "0-5 sec",
      },
      {
        title: "Butter hero shot",
        description: "Overlay script beat two on the butter close-up with a subtle zoom.",
        tag: "6-10 sec",
      },
      {
        title: "Taste reaction",
        description: "Use the customer smile clip after the first bite to make the testimonial feel organic.",
        tag: "11-17 sec",
      },
      {
        title: "Offer close",
        description: "Finish with a map pin, store name, and \"fresh today\" CTA footer.",
        tag: "18-24 sec",
      },
    ],
  },
  {
    id: "milky-donut",
    name: "Milky Donut",
    folder: "2026-03-08-milky-donut",
    clips: 8,
    duration: "05:22 raw footage",
    notes: "Powdered sugar, kids tasting, takeaway bag shot, no ordering clip yet.",
    status: "Waiting for missing proof clip",
    tone: "Fun, snackable",
    stagesDone: 2,
    tags: ["Kids reaction", "Powder top", "Takeaway bag"],
    script: [
      {
        label: "Hook",
        text: "This milky donut tastes like the bakery version of a comfort snack.",
      },
      {
        label: "Store moment",
        text: "I grabbed this from BreadHub because the sugar coating looked impossible to ignore.",
      },
      {
        label: "Taste test",
        text: "It is soft in the middle, lightly sweet, and actually really easy to share.",
      },
      {
        label: "CTA",
        text: "Perfect merienda pick if you want something simple that still feels special.",
      },
    ],
    shots: [
      {
        title: "Fast sugar reveal",
        description: "Start on the powdered sugar macro and speed ramp into the first bite.",
        tag: "0-4 sec",
      },
      {
        title: "Kid reaction proof",
        description: "The kids tasting clip works as social proof even without spoken lines.",
        tag: "5-10 sec",
      },
      {
        title: "Bag shot CTA",
        description: "Use the takeaway bag clip for the final price and location end card.",
        tag: "11-16 sec",
      },
      {
        title: "Missing order beat",
        description: "Prompt the user to upload a cashier or shelf-grab clip before final render.",
        tag: "Needs upload",
      },
    ],
  },
];

const queue = [
  {
    title: "Classic Ensaymada",
    status: "Rendering captions and music bed",
    eta: "ETA 04:12",
    progress: 74,
  },
  {
    title: "Ube Cheese Pandesal",
    status: "Waiting for clip analysis",
    eta: "Needs transcript + keyframes",
    progress: 24,
  },
  {
    title: "Milky Donut",
    status: "Blocked by missing order clip",
    eta: "Upload 1 more proof shot",
    progress: 42,
  },
];

let selectedFolderId = folders[0].id;

const metricsRoot = document.getElementById("metrics");
const folderListRoot = document.getElementById("folder-list");
const selectionRoot = document.getElementById("selection-overview");
const stagesRoot = document.getElementById("stages");
const scriptRoot = document.getElementById("script-block");
const shotRoot = document.getElementById("shot-grid");
const queueRoot = document.getElementById("queue-list");
const toneRoot = document.getElementById("script-tone");

const stageTemplate = [
  {
    label: "Drive Sync",
    description: "Discover new product folder and register a render job.",
  },
  {
    label: "Clip Analysis",
    description: "Transcribe audio, sample keyframes, and classify clip roles.",
  },
  {
    label: "Script Draft",
    description: "Generate hook, tasting story, proof points, and CTA.",
  },
  {
    label: "Render Queue",
    description: "Assemble timeline, captions, overlays, and vertical export.",
  },
];

function getSelectedFolder() {
  return folders.find((folder) => folder.id === selectedFolderId) ?? folders[0];
}

function renderMetrics() {
  const totalClips = folders.reduce((sum, folder) => sum + folder.clips, 0);
  const activeJobs = queue.filter((item) => item.progress < 100).length;
  const draftedScripts = folders.filter((folder) => folder.stagesDone >= 3).length;

  metricsRoot.innerHTML = [
    {
      label: "Tracked Product Folders",
      value: `${folders.length}`,
      detail: "Each folder maps to one product video job.",
    },
    {
      label: "Raw Clips In Pipeline",
      value: `${totalClips}`,
      detail: "Ready for transcript, tagging, and beat selection.",
    },
    {
      label: "Scripts Drafted",
      value: `${draftedScripts}`,
      detail: "Auto-generated from real BreadHub footage.",
    },
    {
      label: "Active Render Jobs",
      value: `${activeJobs}`,
      detail: "Final outputs will land in Firebase Storage.",
    },
  ]
    .map(
      (metric) => `
        <article class="metric">
          <span class="eyebrow">${metric.label}</span>
          <strong>${metric.value}</strong>
          <p>${metric.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderFolderList() {
  folderListRoot.innerHTML = folders
    .map(
      (folder) => `
        <button class="folder-card ${folder.id === selectedFolderId ? "active" : ""}" data-folder-id="${folder.id}" type="button">
          <header>
            <div>
              <div class="folder-title">${folder.name}</div>
              <div class="folder-meta">${folder.folder}</div>
            </div>
            <span class="status-pill">${folder.status}</span>
          </header>
          <div class="folder-meta">${folder.clips} clips · ${folder.duration}</div>
          <div class="folder-meta">${folder.notes}</div>
          <div class="folder-tags">
            ${folder.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
          </div>
        </button>
      `
    )
    .join("");

  folderListRoot.querySelectorAll("[data-folder-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedFolderId = button.dataset.folderId;
      render();
    });
  });
}

function renderSelection() {
  const folder = getSelectedFolder();
  selectionRoot.innerHTML = `
    <div class="selection-head">
      <div class="selection-copy">
        <strong>${folder.name}</strong>
        <p>${folder.notes}</p>
      </div>
      <span class="status-pill">${folder.status}</span>
    </div>
    <div class="selection-meta">
      Source folder: <strong>${folder.folder}</strong><br />
      Media payload: <strong>${folder.clips} clips</strong> · ${folder.duration}
    </div>
    <div class="selection-tags">
      ${folder.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
    </div>
  `;
}

function renderStages() {
  const folder = getSelectedFolder();
  stagesRoot.innerHTML = stageTemplate
    .map((stage, index) => {
      let stateClass = "pending";
      let stateLabel = "Pending";

      if (index < folder.stagesDone) {
        stateClass = "done";
        stateLabel = "Done";
      } else if (index === folder.stagesDone) {
        stateClass = "next";
        stateLabel = "Next";
      }

      return `
        <article class="stage">
          <div class="stage-index">${index + 1}</div>
          <div>
            <strong>${stage.label}</strong>
            <p>${stage.description}</p>
          </div>
          <span class="stage-state ${stateClass}">${stateLabel}</span>
        </article>
      `;
    })
    .join("");
}

function renderScript() {
  const folder = getSelectedFolder();
  toneRoot.textContent = folder.tone;
  scriptRoot.innerHTML = folder.script
    .map(
      (beat) => `
        <article class="script-card">
          <span>${beat.label}</span>
          <div>${beat.text}</div>
        </article>
      `
    )
    .join("");

  shotRoot.innerHTML = folder.shots
    .map(
      (shot) => `
        <article class="shot-card">
          <strong>${shot.title}</strong>
          <p>${shot.description}</p>
          <span class="tag">${shot.tag}</span>
        </article>
      `
    )
    .join("");
}

function renderQueue() {
  queueRoot.innerHTML = queue
    .map(
      (job) => `
        <article class="queue-card">
          <header>
            <div>
              <div class="queue-title">${job.title}</div>
              <div class="queue-meta">${job.status}</div>
            </div>
            <span class="status-pill">${job.eta}</span>
          </header>
          <div class="queue-progress">
            <span style="width: ${job.progress}%"></span>
          </div>
        </article>
      `
    )
    .join("");
}

function advanceSelectedFolder(nextStage) {
  const folder = getSelectedFolder();
  folder.stagesDone = Math.max(folder.stagesDone, nextStage);

  if (folder.stagesDone === 2) {
    folder.status = "Analysis complete";
  }

  if (folder.stagesDone === 3) {
    folder.status = "Script drafted";
  }

  if (folder.stagesDone >= 4) {
    folder.status = "Queued for render";
    const existing = queue.find((job) => job.title === folder.name);
    if (!existing) {
      queue.unshift({
        title: folder.name,
        status: "Queued for vertical export",
        eta: "ETA 06:00",
        progress: 8,
      });
    }
  }

  render();
}

function wireActions() {
  document.getElementById("sync-button").addEventListener("click", () => {
    advanceSelectedFolder(1);
  });

  document.getElementById("analyze-button").addEventListener("click", () => {
    advanceSelectedFolder(2);
  });

  document.getElementById("script-button").addEventListener("click", () => {
    advanceSelectedFolder(3);
  });

  document.getElementById("render-button").addEventListener("click", () => {
    advanceSelectedFolder(4);
  });
}

function render() {
  renderMetrics();
  renderFolderList();
  renderSelection();
  renderStages();
  renderScript();
  renderQueue();
}

render();
wireActions();
