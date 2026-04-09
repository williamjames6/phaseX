import { Stack } from 'expo-router';

export default function DailyStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Daily',
        }}
      />
      <Stack.Screen
        name="sleep/entry"
        options={{
          title: 'Sleep',
        }}
      />
      <Stack.Screen
        name="trainingLoad/session"
        options={{
          title: 'Training',
        }}
      />
      <Stack.Screen
        name="gym/session"
        options={{
          title: 'Gym',
        }}
      />
      <Stack.Screen
        name="film/journalEntry/index"
        options={{
          title: 'Film',
        }}
      />
      <Stack.Screen
        name="film/journalEntry/sketchpad/new"
        options={{
          title: 'Sketch',
        }}
      />
    </Stack>
  );
}
