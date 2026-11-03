import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "app.lifeos.tracker",
  appName: "Life OS",
  webDir: "dist",
  android: {
    // The app bundles its own assets, so nothing needs to load over plain HTTP.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: "#e8e8e7",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT",
      backgroundColor: "#e8e8e7",
    },
    CapacitorHttp: {
      // Routes fetch/XHR through the native layer so Strava and OpenRouter
      // are not blocked by the WebView's CORS policy.
      enabled: true,
    },
  },
}

export default config
