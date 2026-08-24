export type AppMode = "trial" | "product";

export const TRIAL_DOCUMENT_ID = "kango-canvas-trial-workspace";

export function getInitialAppMode(): AppMode {
  if (!import.meta.env.DEV) return "trial";

  const requested = new URLSearchParams(window.location.search).get("mode");
  if (requested === "trial" || requested === "product") return requested;

  return sessionStorage.getItem("kango-canvas-dev-mode") === "product"
    ? "product"
    : "trial";
}

export function rememberDevelopmentMode(mode: AppMode) {
  if (import.meta.env.DEV) {
    sessionStorage.setItem("kango-canvas-dev-mode", mode);
  }
}
