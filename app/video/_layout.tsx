import React from 'react';
import { Stack } from 'expo-router';

export default function VideoLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Video',
          headerShown: true,
        }}
      />
    </Stack>
  );
} 