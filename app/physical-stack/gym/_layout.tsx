import { Stack } from 'expo-router';
import React from 'react';

export default function GymLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Gym Sessions',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="session"
        options={{
          title: 'Gym Session',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
