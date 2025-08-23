import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants';

// In Expo, we can access EXPO_PUBLIC_* variables directly
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseKey = Constants.expoConfig?.extra?.supabaseKey;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey) 