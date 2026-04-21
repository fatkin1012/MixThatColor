import "./styles.css";
import { hexToRgb, normalizeHex, rgbToHex } from "./color";
import { solveMix, type Dye, type MixResult } from "./mix";

const DEFAULT_DYES: Dye[] = [
  { id: crypto.randomUUID(), name: "Cyan", hex: "#1fc7d4" },
  { id: crypto.randomUUID(), name: "Magenta", hex: "#ef4fa1" },
  { id: crypto.randomUUID(), name: "Yellow", hex: "#f7d14a" },
  { id: crypto.randomUUID(), name: "White", hex: "#f5f7fb" },
];

const MAX_DYES = 6;

const state = {
  targetHex: "#c96d3d",
  totalDrops: 20,
  targetPoint: null as { x: number; y: number } | null,
  image: null as HTMLImageElement | null,
  dyes: [...DEFAULT_DYES],
  dyeDraftHex: {} as Record<string, string>,
  activeDyeId: null as string | null,
  result: null as MixResult | null,
};

const photoInput = document.getElementById("photo-input") as HTMLInputElement;
const canvas = document.getElementById("photo-canvas") as HTMLCanvasElement;
const canvasShell = document.getElementById("canvas-shell") as HTMLDivElement;
const canvasEmpty = document.getElementById("canvas-empty") as HTMLDivElement;
const targetHexInput = document.getElementById("target-hex") as HTMLInputElement;
const targetColorInput = document.getElementById("target-color") as HTMLInputElement;
const targetSwatch = document.getElementById("target-swatch") as HTMLDivElement;
const totalDropsInput = document.getElementById("total-drops") as HTMLInputElement;
const totalDropsValue = document.getElementById("total-drops-value") as HTMLOutputElement;
const dyeList = document.getElementById("dye-list") as HTMLDivElement;
const addDyeButton = document.getElementById("add-dye-button") as HTMLButtonElement;
const qualityPill = document.getElementById("quality-pill") as HTMLDivElement;
const resultEmpty = document.getElementById("result-empty") as HTMLDivElement;
const resultBody = document.getElementById("result-body") as HTMLDivElement;
const recipeTitle = document.getElementById("recipe-title") as HTMLHeadingElement;
const recipeNote = document.getElementById("recipe-note") as HTMLParagraphElement;
const compareTarget = document.getElementById("compare-target") as HTMLDivElement;
const compareResult = document.getElementById("compare-result") as HTMLDivElement;
const targetCode = document.getElementById("target-code") as HTMLElement;
const resultCode = document.getElementById("result-code") as HTMLElement;
const dropList = document.getElementById("drop-list") as HTMLDivElement;
const pickerDialog = document.getElementById("dye-picker-dialog") as HTMLDialogElement;
const pickerDyeName = document.getElementById("picker-dye-name") as HTMLHeadingElement;
const pickerPreview = document.getElementById("picker-preview") as HTMLDivElement;
const pickerColorInput = document.getElementById("picker-color") as HTMLInputElement;
const pickerHexInput = document.getElementById("picker-hex") as HTMLInputElement;
const pickerConfirmButton = document.getElementById("picker-confirm-button") as HTMLButtonElement;
const pickerCancelButton = document.getElementById("picker-cancel-button") as HTMLButtonElement;
const pickerCloseButton = document.getElementById("picker-close-button") as HTMLButtonElement;

const canvasContext = canvas.getContext("2d");

if (!canvasContext) {
  throw new Error("Canvas rendering is not supported in this browser.");
}

const drawingContext: CanvasRenderingContext2D = canvasContext;
let drawFrameId: number | null = null;

function createDye(name = "New dye", hex = "#7a8cff"): Dye {
  return {
    id: crypto.randomUUID(),
    name,
    hex,
  };
}

function isValidHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function setTargetHex(value: string) {
  if (!isValidHex(value)) {
    return;
  }

  state.targetHex = rgbToHex(hexToRgb(value));
  updateResult();
  render();
}

function updateResult() {
  state.result = solveMix(state.targetHex, state.dyes, state.totalDrops);
}

function getDyeById(dyeId: string | null): Dye | null {
  if (!dyeId) {
    return null;
  }

  return state.dyes.find((dye) => dye.id === dyeId) ?? null;
}

function closePicker(discardDraft = true) {
  if (discardDraft && state.activeDyeId) {
    delete state.dyeDraftHex[state.activeDyeId];
  }

  state.activeDyeId = null;

  if (pickerDialog.open) {
    pickerDialog.close();
  }

  render();
}

function syncPickerDraft(nextHex: string) {
  const activeDye = getDyeById(state.activeDyeId);

  if (!activeDye) {
    return;
  }

  state.dyeDraftHex[activeDye.id] = nextHex;
  pickerColorInput.value = nextHex;
  pickerHexInput.value = nextHex;
  pickerPreview.style.background = nextHex;
  pickerConfirmButton.disabled = nextHex === activeDye.hex;
}

function openPicker(dyeId: string) {
  const activeDye = getDyeById(dyeId);

  if (!activeDye) {
    return;
  }

  state.activeDyeId = dyeId;
  const draftHex = state.dyeDraftHex[dyeId] ?? activeDye.hex;
  state.dyeDraftHex[dyeId] = draftHex;
  pickerDyeName.textContent = activeDye.name;
  syncPickerDraft(draftHex);

  if (!pickerDialog.open) {
    pickerDialog.showModal();
  }
}

function requestDrawImage() {
  if (drawFrameId !== null) {
    cancelAnimationFrame(drawFrameId);
  }

  drawFrameId = window.requestAnimationFrame(() => {
    drawFrameId = null;
    drawImage();
  });
}

function drawImage() {
  const image = state.image;

  if (!image) {
    canvas.width = 1;
    canvas.height = 1;
    drawingContext.clearRect(0, 0, canvas.width, canvas.height);
    canvas.hidden = true;
    canvasEmpty.hidden = false;
    return;
  }

  const shellWidth = canvasShell.getBoundingClientRect().width || canvasShell.clientWidth || Math.min(window.innerWidth - 24, 920);

  if (shellWidth <= 0) {
    requestDrawImage();
    return;
  }

  const maxWidth = Math.min(shellWidth, 920);
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  canvas.hidden = false;
  canvasEmpty.hidden = true;
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  drawingContext.clearRect(0, 0, width, height);
  drawingContext.drawImage(image, 0, 0, width, height);

  if (state.targetPoint) {
    const { x, y } = state.targetPoint;

    drawingContext.save();
    drawingContext.lineWidth = 3;
    drawingContext.strokeStyle = "rgba(255, 255, 255, 0.95)";
    drawingContext.fillStyle = "rgba(15, 23, 42, 0.9)";
    drawingContext.beginPath();
    drawingContext.arc(x, y, 9, 0, Math.PI * 2);
    drawingContext.fill();
    drawingContext.stroke();
    drawingContext.beginPath();
    drawingContext.arc(x, y, 18, 0, Math.PI * 2);
    drawingContext.lineWidth = 2;
    drawingContext.strokeStyle = "rgba(243, 180, 91, 0.9)";
    drawingContext.stroke();
    drawingContext.restore();
  }
}

function sampleCanvasColor(event: MouseEvent) {
  if (!state.image) {
    return;
  }

  const bounds = canvas.getBoundingClientRect();
  const scaleX = canvas.width / bounds.width;
  const scaleY = canvas.height / bounds.height;
  const x = Math.min(canvas.width - 1, Math.max(0, Math.round((event.clientX - bounds.left) * scaleX)));
  const y = Math.min(canvas.height - 1, Math.max(0, Math.round((event.clientY - bounds.top) * scaleY)));
  const pixel = drawingContext.getImageData(x, y, 1, 1).data;

  state.targetPoint = { x, y };
  state.targetHex = rgbToHex({ r: pixel[0] ?? 0, g: pixel[1] ?? 0, b: pixel[2] ?? 0 });
  updateResult();
  render();
}

function formatRecipe(result: MixResult | null): string {
  if (!result) {
    return "No recipe yet";
  }

  const parts = result.drops
    .map((drops, index) => ({ drops, dye: state.dyes[index] }))
    .filter((item): item is { drops: number; dye: Dye } => item.drops > 0 && Boolean(item.dye))
    .map((item) => `${item.drops} drop${item.drops === 1 ? "" : "s"} ${item.dye.name}`);

  return parts.join(", ");
}

function qualityLabel(distance: number): string {
  if (distance < 4) {
    return "Very close";
  }

  if (distance < 10) {
    return "Close match";
  }

  if (distance < 20) {
    return "Usable match";
  }

  return "Approximate";
}

function renderDyes() {
  dyeList.replaceChildren();

  state.dyes.forEach((dye, index) => {
    const currentDye = state.dyes[index]!;
    const draftHex = state.dyeDraftHex[dye.id] ?? dye.hex;
    const row = document.createElement("div");
    row.className = "dye-row";

    const nameField = document.createElement("label");
    nameField.className = "field dye-name-field";
    nameField.innerHTML = "<span>Dye name</span>";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = dye.name;
    nameInput.autocomplete = "off";
    nameInput.spellcheck = false;
    nameInput.setAttribute("data-dye-name", dye.id);
    nameField.append(nameInput);

    const preview = document.createElement("div");
    preview.className = "dye-preview";
    preview.style.background = draftHex;
    preview.setAttribute("aria-hidden", "true");

    const colorValue = document.createElement("code");
    colorValue.className = "dye-color-value";
    colorValue.textContent = draftHex;

    const colorMeta = document.createElement("div");
    colorMeta.className = "dye-color-meta";
    colorMeta.append(preview, colorValue);

    const colorButton = document.createElement("button");
    colorButton.className = "button secondary color-edit-button";
    colorButton.type = "button";
    colorButton.textContent = "Edit color";
    colorButton.setAttribute("data-edit-dye", dye.id);

    const removeButton = document.createElement("button");
    removeButton.className = "button remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.disabled = state.dyes.length === 1;
    removeButton.setAttribute("data-remove-dye", dye.id);

    nameInput.addEventListener("input", () => {
      currentDye.name = nameInput.value.trim() || "Untitled dye";
      updateResult();
      render();
    });

    colorButton.addEventListener("click", () => {
      openPicker(dye.id);
    });

    removeButton.addEventListener("click", () => {
      delete state.dyeDraftHex[dye.id];
      state.dyes.splice(index, 1);
      if (state.activeDyeId === dye.id) {
        state.activeDyeId = null;
        if (pickerDialog.open) {
          pickerDialog.close();
        }
      }
      updateResult();
      render();
    });

    row.append(nameField, colorMeta, colorButton, removeButton);
    dyeList.append(row);
  });
}

function renderResult() {
  const result = state.result;

  if (!result) {
    resultEmpty.hidden = false;
    resultBody.hidden = true;
    qualityPill.textContent = "Waiting for input";
    return;
  }

  resultEmpty.hidden = true;
  resultBody.hidden = false;

  const mixLabel = formatRecipe(result);
  recipeTitle.textContent = mixLabel;
  recipeNote.textContent = `The solver searched ${state.totalDrops} total drops and chose the closest visible match in Lab color space.`;
  qualityPill.textContent = qualityLabel(result.distance);
  compareTarget.style.background = state.targetHex;
  compareResult.style.background = result.mixedHex;
  targetCode.textContent = state.targetHex;
  resultCode.textContent = result.mixedHex;

  dropList.replaceChildren();

  result.drops.forEach((drops, index) => {
    if (drops <= 0) {
      return;
    }

    const dye = state.dyes[index];

    if (!dye) {
      return;
    }

    const item = document.createElement("div");
    item.className = "drop-item";
    const colorDot = document.createElement("span");
    colorDot.className = "drop-color";
    colorDot.style.background = dye.hex;

    const textWrap = document.createElement("div");
    const dyeName = document.createElement("strong");
    dyeName.textContent = dye.name;
    const dropLabel = document.createElement("span");
    dropLabel.textContent = `${drops} drop${drops === 1 ? "" : "s"}`;

    textWrap.append(dyeName, dropLabel);
    item.append(colorDot, textWrap);
    dropList.append(item);
  });
}

function render() {
  targetHexInput.value = state.targetHex;
  targetColorInput.value = state.targetHex;
  targetSwatch.style.background = state.targetHex;
  totalDropsInput.value = `${state.totalDrops}`;
  totalDropsValue.textContent = `${state.totalDrops} drop${state.totalDrops === 1 ? "" : "s"}`;
  drawImage();
  renderDyes();
  renderResult();
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.image = image;
      state.targetPoint = null;
      requestDrawImage();
    };
    image.src = String(reader.result);
  };

  reader.readAsDataURL(file);
});

canvas.addEventListener("click", sampleCanvasColor);

targetHexInput.addEventListener("change", () => {
  setTargetHex(targetHexInput.value);
});

targetColorInput.addEventListener("input", () => {
  setTargetHex(targetColorInput.value);
});

totalDropsInput.addEventListener("input", () => {
  state.totalDrops = Number(totalDropsInput.value);
  totalDropsValue.textContent = `${state.totalDrops} drop${state.totalDrops === 1 ? "" : "s"}`;
  updateResult();
  renderResult();
});

addDyeButton.addEventListener("click", () => {
  if (state.dyes.length >= MAX_DYES) {
    return;
  }

  const newDye = createDye();
  state.dyes.push(newDye);
  state.dyeDraftHex[newDye.id] = newDye.hex;
  updateResult();
  render();
});

pickerColorInput.addEventListener("input", () => {
  syncPickerDraft(normalizeHex(pickerColorInput.value));
});

pickerColorInput.addEventListener("change", () => {
  syncPickerDraft(normalizeHex(pickerColorInput.value));
});

pickerHexInput.addEventListener("input", () => {
  syncPickerDraft(normalizeHex(pickerHexInput.value));
});

pickerHexInput.addEventListener("change", () => {
  if (!isValidHex(pickerHexInput.value)) {
    const activeDye = getDyeById(state.activeDyeId);
    if (activeDye) {
      syncPickerDraft(activeDye.hex);
    }
    return;
  }

  syncPickerDraft(rgbToHex(hexToRgb(pickerHexInput.value)));
});

pickerConfirmButton.addEventListener("click", () => {
  const activeDye = getDyeById(state.activeDyeId);

  if (!activeDye) {
    closePicker();
    return;
  }

  if (!isValidHex(pickerHexInput.value)) {
    syncPickerDraft(activeDye.hex);
    return;
  }

  activeDye.hex = rgbToHex(hexToRgb(pickerHexInput.value));
  delete state.dyeDraftHex[activeDye.id];
  state.activeDyeId = null;
  pickerDialog.close();
  updateResult();
  render();
});

pickerCancelButton.addEventListener("click", () => {
  closePicker(true);
});

pickerCloseButton.addEventListener("click", () => {
  closePicker(true);
});

pickerDialog.addEventListener("close", () => {
  if (state.activeDyeId) {
    delete state.dyeDraftHex[state.activeDyeId];
  }

  state.activeDyeId = null;
  render();
});

pickerDialog.addEventListener("click", (event) => {
  if (event.target === pickerDialog) {
    closePicker(true);
  }
});

window.addEventListener("resize", () => {
  if (state.image) {
    requestDrawImage();
  }
});

const resizeObserver = new ResizeObserver(() => {
  if (state.image) {
    requestDrawImage();
  }
});

resizeObserver.observe(canvasShell);

canvasShell.addEventListener("dragover", (event) => {
  event.preventDefault();
});

canvasShell.addEventListener("drop", (event) => {
  event.preventDefault();

  const file = event.dataTransfer?.files?.[0];
  if (!file || !file.type.startsWith("image/")) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.image = image;
      state.targetPoint = null;
      requestDrawImage();
    };
    image.src = String(reader.result);
  };

  reader.readAsDataURL(file);
});

canvasShell.addEventListener("click", () => {
  if (!state.image) {
    photoInput.click();
  }
});

updateResult();
render();
