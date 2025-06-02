export default {
  expo: {
    name: "PhaseX",
    slug: "PhaseX",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#ffffff"
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwbGNnanZyb2premh4a2JxcHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MjY5MjYsImV4cCI6MjA2NDQwMjkyNn0.WtPcIwyjFcEXJJg-l345QsTN92jaOo0SdScLsZKVWcA'
    },
    scheme: "phasex"
  }
}; 