import { Stack } from 'expo-router';
import React from 'react';

export default function PhysicalLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="gym/index"
        options={{
          title: 'Gym Sessions',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="gym/session"
        options={{
          title: 'Gym Session',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="trainingLoad/index"
        options={{
          title: 'Training Load',
          headerShown: true,
        }}
      />
    </Stack>
  );
} 