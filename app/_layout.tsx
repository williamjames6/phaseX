import { Stack } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export default function Layout() {
  return (
    <KeyboardProvider preload={false}>
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", headerTitle: "" }}>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="registration/register" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="home" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen
        name="daily-stack"
        options={{
          headerShown: false
        }}
      />
    </Stack>
    </KeyboardProvider>
  );
}