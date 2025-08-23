import { Stack } from 'expo-router';
import React from 'react';

export default function PhysicalLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Physical',
          headerShown: true,
        }}
      />
    </Stack>
  );
} 