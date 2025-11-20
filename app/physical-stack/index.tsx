import { Link } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';

export default function PhysicalIndex() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  useHeaderWithMenu({
    title: 'Physical',
    onMenuPress: () => setIsSidebarVisible(true),
  });

  return (
    <View style={styles.container}>
      <Link href="/physical-stack/trainingLoad" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Training Load</Text>
        </TouchableOpacity>
      </Link>
      <Link href="/physical-stack/gym" asChild>
        <TouchableOpacity style={styles.gymButton}>
          <Text style={styles.buttonText}>Gym</Text>
        </TouchableOpacity>
      </Link>
      <Link href="/physical-stack/nutrition" asChild>
        <TouchableOpacity style={styles.nutritionButton}>
          <Text style={styles.buttonText}>Nutrition</Text>
        </TouchableOpacity>
      </Link>
      
      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'black',
    gap: 16,
  },
  button: {
    backgroundColor: '#89898a',
    padding: 22.5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymButton: {
    backgroundColor: '#FF6B35',
    padding: 22.5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionButton: {
    backgroundColor: '#e3f2fd',
    padding: 22.5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
}); 