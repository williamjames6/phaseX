import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function VideoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Video Module</Text>
      <Text style={styles.subtitle}>Analyze your form and technique</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#e8f5e9',
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