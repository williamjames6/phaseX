import React from 'react';
import { Stack } from 'expo-router';

export default function GymLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Gym',
          //headerShown: true,
        }}
      />
    </Stack>
  );
} 