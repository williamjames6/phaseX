import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { TouchableOpacity } from 'react-native';

export default function PhysicalLayout() {
  return (
    <Stack
      screenOptions={({ navigation }) => ({
        headerBackButtonDisplayMode: 'minimal',
        headerLeft: ({ tintColor }) => (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 8, marginLeft: 8, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={24} color={tintColor ?? '#ffffff'} />
          </TouchableOpacity>
        ),
      })}
    >
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
      <Stack.Screen
        name="trainingLoad/session"
        options={{
          title: 'Training Session',
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
        name="nutrition/index"
        options={{
          title: 'Nutrition',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="sleep/index"
        options={{
          title: 'Sleep',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="sleep/entry"
        options={{
          title: 'Sleep Entry',
          headerStyle: {
            backgroundColor: '#000',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
    </Stack>
  );
} 