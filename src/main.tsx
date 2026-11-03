import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
// Loaded last so the design system has the final word on layout and scale.
import "./styles/system.css"
import { isNative } from "./services/platform"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

/**
 * Register the service worker for the installable web build only. Inside the
 * native shell every asset is already on the device, and a stale cache there
 * would survive app updates.
 *
 * Registered directly rather than through `virtual:pwa-register` so the build
 * does not need workbox-window; the worker is generated with autoUpdate, so it
 * takes over on its own.
 */
if (!isNative() && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error)
    })
  })
}
