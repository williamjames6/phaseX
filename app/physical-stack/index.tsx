import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';

export default function PhysicalIndex() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');

  useHeaderWithMenu({
    title: 'Physical',
    onMenuPress: () => setIsSidebarVisible(true),
  });

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
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
        <Link href="/physical-stack/sleep" asChild>
          <TouchableOpacity style={styles.sleepButton}>
            <Text style={styles.buttonText}>Sleep</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
      
      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  button: {
    backgroundColor: '#FF6B35',
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
    backgroundColor: '#FF6B35',
    padding: 22.5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepButton: {
    backgroundColor: '#FF6B35',
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
  textInputContainer: {
    width: '100%',
    marginTop: 16,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: 'black',
  },
}); 