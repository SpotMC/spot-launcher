export interface SplashState {
  step: "i18n" | "core" | "builds" | "ready"
  status: string
  progress: number
}

const STEP_LABEL: Record<SplashState["step"], string> = {
  i18n: "Модули",
  core: "Ядро",
  builds: "Интерфейс",
  ready: "Готово",
}

export function updateSplash(state: SplashState) {
  const bar = document.getElementById("splash-bar")
  const status = document.getElementById("splash-status")
  const subtitle = document.getElementById("splash-subtitle")
  if (bar) {
    bar.classList.add("determinate")
    bar.style.width = `${Math.max(0, Math.min(100, state.progress))}%`
  }
  if (subtitle) subtitle.textContent = STEP_LABEL[state.step]
  if (status) {
    const dots = state.step === "ready"
      ? ""
      : `<span class="loading-dots"><span></span><span></span><span></span></span>`
    status.innerHTML = `${escapeHtml(state.status)}${dots}`
  }
}

export function hideSplash() {
  const splash = document.getElementById("splash")
  if (!splash || splash.dataset.hidden === "1") return
  splash.dataset.hidden = "1"
  splash.classList.add("fade")
  window.setTimeout(() => splash.remove(), 380)
}

export function finishBoot() {
  const legal = new URLSearchParams(window.location.search).get("win") === "legal"
  if (!legal) window.electronAPI?.notifyUiReady()
  window.setTimeout(hideSplash, legal ? 0 : 50)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char
  ))
}
