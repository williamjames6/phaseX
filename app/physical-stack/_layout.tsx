import { Stack } from 'expo-router';

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
          headerStyle: {
            backgroundColor: '#000',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
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