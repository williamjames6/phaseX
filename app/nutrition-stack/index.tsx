import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';

export default function NutritionScreen() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  useHeaderWithMenu({
    title: 'Nutrition',
    onMenuPress: () => setIsSidebarVisible(true),
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Nutrition Module</Text>
        <Text style={styles.subtitle}>Track your meals and nutrition goals</Text>
      </View>
      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e3f2fd',
  },
  content: {
    flex: 1,
    padding: 20,
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