import { Stack } from 'expo-router';

export default function TrainingLoadLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Training Load',
          headerShown: true,
        }}
      />
    </Stack>
  );
} 