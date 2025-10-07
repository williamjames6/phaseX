import { Stack } from 'expo-router';
import React from 'react';

export default function NutritionLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
        }}
      />
    </Stack>
  );
} 