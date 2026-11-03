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
      launchShowDuration: 800,
      launchAutoHide: false,
      backgroundColor: "#e8e8e7",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      // The page draws its own background behind the bars and MainActivity
      // reports their heights, so the WebView is free to go edge to edge.
      // Android 15 enforces this anyway for targetSdk 35+.
      overlaysWebView: true,
      style: "LIGHT",
    },
    CapacitorHttp: {
      // Routes fetch/XHR through the native layer so Strava and OpenRouter
      // are not blocked by the WebView's CORS policy.
      enabled: true,
    },
  },
}

export default config
