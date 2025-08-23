import { Stack } from 'expo-router';
import React from 'react';

export default function JournalLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Journal',
          headerStyle: {
            backgroundColor: '#fff3e0',
          },
          headerTintColor: '#000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen
        name="journalEntry/index"
        options={{
          title: 'Journal Entry',
          headerStyle: {
            backgroundColor: '#fff3e0',
          },
          headerTintColor: '#000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen
        name="journalEntry/sketchpad/index"
        options={{
          title: 'Sketchpad',
          headerStyle: {
            backgroundColor: '#fff3e0',
          },
          headerTintColor: '#000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen
        name="journalEntry/sketchpad/new"
        options={{
          title: 'New Sketch',
          headerStyle: {
            backgroundColor: '#fff3e0',
          },
          headerTintColor: '#000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
    </Stack>
  );
} 