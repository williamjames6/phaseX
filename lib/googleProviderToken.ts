import * as SecureStore from 'expo-secure-store';

const GOOGLE_PROVIDER_TOKEN_KEY = 'google_provider_token';

export async function setGoogleProviderToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(GOOGLE_PROVIDER_TOKEN_KEY, token);
}

export async function getGoogleProviderToken(): Promise<string | null> {
  return SecureStore.getItemAsync(GOOGLE_PROVIDER_TOKEN_KEY);
}

