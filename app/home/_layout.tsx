import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", headerTitle: "" }}>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: true 
        }} 
      />
    </Stack>
  );
}
