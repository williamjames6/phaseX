import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NutritionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nutrition Module</Text>
      <Text style={styles.subtitle}>Track your meals and nutrition goals</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#e3f2fd',
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