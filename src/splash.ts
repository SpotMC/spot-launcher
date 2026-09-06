const DONE_STEPS = ["i18n", "core", "builds", "ready"]

export interface SplashState {
  step: "i18n" | "core" | "builds" | "ready"
  status: string
  progress: number
}

export function updateSplash(state: SplashState) {
  const bar = document.getElementById("splash-bar")
  const status = document.getElementById("splash-status")
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, state.progress))}%`
  if (status) {
    const statusText = state.status
    const highlightText = statusText.split(' ').pop()
    status.innerHTML = `${statusText}<span class="highlight"> ${highlightText}</span><span class="loading-dots"><span></span><span></span><span></span></span>`
  }
}

export function hideSplash() {
  const splash = document.getElementById("splash")
  if (!splash || splash.dataset.hidden === "1") return
  splash.dataset.hidden = "1"
  splash.classList.add("fade")
  window.setTimeout(() => splash.remove(), 380)
}
