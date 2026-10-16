"use strict";

const THEME_KEY = "lumen-theme";

const promptInput = document.getElementById("prompt");
const counter = document.getElementById("counter");
const promptHint = document.getElementById("promptHint");
const form = document.getElementById("composer");
const generateBtn = document.getElementById("generateBtn");
const generateLabel = document.getElementById("generateLabel");
const themeToggle = document.getElementById("themeToggle");
const themeLabel = document.getElementById("themeLabel");
const stage = document.getElementById("stage");
const emptyState = document.getElementById("emptyState");
const loadingMask = document.getElementById("loadingMask");
const resultImage = document.getElementById("resultImage");
const errorBanner = document.getElementById("errorBanner");
const resultMeta = document.getElementById("resultMeta");
const originText = document.getElementById("originText");
const promptText = document.getElementById("promptText");
const notice = document.getElementById("notice");
const metaLine = document.getElementById("metaLine");
const downloadBtn = document.getElementById("downloadBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const copyBtn = document.getElementById("copyBtn");
const copyLabel = document.getElementById("copyLabel");
const liveStatus = document.getElementById("liveStatus");

const state = {
  originalPrompt: "",
  enhancedPrompt: "",
  seed: null,
  imageUrl: "",
  enhancedBy: "",
  notice: "",
  busy: false,
  imageReady: false,
};

let requestToken = 0;
let copyTimer = 0;
let shownSrc = "";
let readyImageUrl = "";
let readySeed = null;

function currentTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", currentTheme() === "dark" ? "#101114" : "#f2f4f6");
}

function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.setAttribute("aria-label", dark ? "라이트 모드로 전환" : "다크 모드로 전환");
  themeLabel.textContent = dark ? "라이트" : "다크";
  syncThemeColor();
}

function setStatus(message) {
  liveStatus.textContent = message;
}

function updateCounter() {
  counter.textContent = `${promptInput.value.length} / 500`;
}

function setBusy(busy) {
  state.busy = busy;
  generateBtn.disabled = busy;
  generateBtn.setAttribute("aria-busy", busy ? "true" : "false");
  generateLabel.textContent = busy ? "생성 중..." : "이미지 생성";
  regenerateBtn.disabled = busy || !state.enhancedPrompt;
  copyBtn.disabled = !state.enhancedPrompt;
  downloadBtn.disabled = busy || !state.imageReady;
}

function showLoading() {
  errorBanner.hidden = true;
  emptyState.hidden = true;
  loadingMask.hidden = false;
  if (window.innerWidth < 1024) {
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showError(message) {
  loadingMask.hidden = true;
  errorBanner.hidden = false;
  errorBanner.textContent = message;
  if (!state.imageReady) {
    resultImage.hidden = true;
    emptyState.hidden = false;
  }
  setBusy(false);
  setStatus(message);
}

function renderMeta() {
  resultMeta.hidden = false;
  originText.textContent = `입력 · ${state.originalPrompt}`;
  promptText.textContent = state.enhancedPrompt;
  const via = state.enhancedBy === "groq" ? "Groq" : state.enhancedBy === "reuse" ? "같은 프롬프트" : "내장 규칙";
  metaLine.textContent = `시드 ${state.seed} · 프롬프트 확장 ${via}`;
  notice.hidden = !state.notice;
  notice.textContent = state.notice || "";
}

function restorePreviousImage() {
  if (!shownSrc) {
    resultImage.hidden = true;
    emptyState.hidden = false;
    return;
  }
  resultImage.hidden = false;
  emptyState.hidden = true;
  if (resultImage.src !== shownSrc) {
    resultImage.onload = () => {
      resultImage.hidden = false;
    };
    resultImage.src = shownSrc;
  }
}

function loadImage(token, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  return fetch(url, { signal: controller.signal })
    .then(async (response) => {
      if (token !== requestToken) return;
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "이미지를 불러오지 못했습니다. 다시 시도해 주세요.");
      }
      const blob = await response.blob();
      if (token !== requestToken) return;
      if (shownSrc.startsWith("blob:")) URL.revokeObjectURL(shownSrc);
      const objectUrl = URL.createObjectURL(blob);
      shownSrc = objectUrl;
      readyImageUrl = url;
      readySeed = state.seed;
      resultImage.alt = state.originalPrompt || "생성된 이미지";
      await new Promise((resolve, reject) => {
        resultImage.onload = () => resolve();
        resultImage.onerror = () => reject(new Error("이미지를 불러오지 못했습니다. 다시 시도해 주세요."));
        resultImage.src = objectUrl;
      });
      if (token !== requestToken) return;
      resultImage.hidden = false;
      resultImage.classList.add("is-in");
      loadingMask.hidden = true;
      emptyState.hidden = true;
      errorBanner.hidden = true;
      state.imageReady = true;
      setBusy(false);
      setStatus("이미지를 만들었습니다.");
    })
    .catch((error) => {
      if (token !== requestToken) return;
      restorePreviousImage();
      const message =
        error.name === "AbortError"
          ? "이미지 생성이 지연되고 있습니다. 다시 시도해 주세요."
          : error.message || "이미지를 불러오지 못했습니다. 다시 시도해 주세요.";
      showError(message);
    })
    .finally(() => {
      clearTimeout(timeout);
    });
}

async function generate({ regenerate }) {
  const prompt = (regenerate ? state.originalPrompt : promptInput.value).trim();
  if (!prompt || state.busy) return;

  const token = ++requestToken;
  setBusy(true);
  showLoading();
  setStatus("AI가 그림을 그리는 중...");

  try {
    const payload = regenerate
      ? { prompt, enhancedPrompt: state.enhancedPrompt, skipEnhance: true }
      : { prompt };

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (token !== requestToken) return;
    if (!response.ok) throw new Error(data.error || "이미지를 만들지 못했습니다.");

    state.originalPrompt = data.originalPrompt;
    state.enhancedPrompt = data.enhancedPrompt;
    state.seed = data.seed;
    state.imageUrl = data.imageUrl;
    state.enhancedBy = data.enhancedBy;
    state.notice = data.notice || "";
    renderMeta();
    await loadImage(token, data.imageUrl);
  } catch (error) {
    if (token !== requestToken) return;
    showError(error.message || "이미지를 만들지 못했습니다.");
  }
}

async function copyPrompt() {
  if (!state.enhancedPrompt) return;
  try {
    await navigator.clipboard.writeText(state.enhancedPrompt);
  } catch (error) {
    const area = document.createElement("textarea");
    area.value = state.enhancedPrompt;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  copyLabel.textContent = "복사됨";
  setStatus("프롬프트를 복사했습니다.");
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copyLabel.textContent = "프롬프트 복사";
  }, 1500);
}

async function downloadImage() {
  if (!readyImageUrl || !state.imageReady) return;
  downloadBtn.disabled = true;
  try {
    const response = await fetch(readyImageUrl);
    if (!response.ok) throw new Error("파일을 저장하지 못했습니다. 다시 시도해 주세요.");
    const blob = await response.blob();
    const type = blob.type || "";
    const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lumen-${readySeed}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("이미지 파일을 저장했습니다.");
  } catch (error) {
    showError(error.message);
  } finally {
    downloadBtn.disabled = !state.imageReady || state.busy;
  }
}

if (/Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent)) {
  promptHint.textContent = "⌘ + Enter 로 바로 생성";
}

applyTheme(currentTheme());
updateCounter();
setBusy(false);

themeToggle.addEventListener("click", () => {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
});

promptInput.addEventListener("input", updateCounter);

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generate({ regenerate: false });
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    promptInput.value = chip.dataset.prompt || "";
    updateCounter();
    promptInput.focus();
  });
});

regenerateBtn.addEventListener("click", () => generate({ regenerate: true }));
copyBtn.addEventListener("click", copyPrompt);
downloadBtn.addEventListener("click", downloadImage);
