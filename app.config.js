require('dotenv').config(); //to be able to use .env file and store private keys as environment variables

export default {
  expo: {
    name: 'phaseX',
    slug: 'phaseX',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/onwards.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.wiles99.phaseX"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      package: 'com.wiles99.phaseX'
    },
    web: {
      favicon: './assets/images/favicon.png'
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      "eas": {
        "projectId": "ae71b928-10c5-4fa4-8503-f2b7d3cbed31"
      }
    },
    scheme: "phasex",
    plugins: [
      [
        "expo-local-authentication",
        {
          "faceIDPermission": "Allow phaseX to use Face ID."
        }
      ],
      "expo-router",
      "expo-secure-store",
      "expo-web-browser"
    ]
  }
}; 