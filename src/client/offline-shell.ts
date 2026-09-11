export function installOfflineShell() {
  if (
    !import.meta.env.PROD ||
    window.desktop ||
    !("serviceWorker" in navigator) ||
    !window.isSecureContext
  )
    return;
  const register = () =>
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  if ("requestIdleCallback" in window)
    window.requestIdleCallback(register, { timeout: 4000 });
  else globalThis.setTimeout(register, 1000);
}
