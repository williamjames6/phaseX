import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function GymScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gym Module</Text>
      <Text style={styles.subtitle}>Track your workouts and progress</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f3e5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
}); 