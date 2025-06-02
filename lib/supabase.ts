import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cplcgjvrojkzhxkbqpwa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwbGNnanZyb2premh4a2JxcHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MjY5MjYsImV4cCI6MjA2NDQwMjkyNn0.WtPcIwyjFcEXJJg-l345QsTN92jaOo0SdScLsZKVWcA'
export const supabase = createClient(supabaseUrl, supabaseKey) 