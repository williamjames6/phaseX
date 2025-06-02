import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, FlatList, Dimensions } from 'react-native';
import { supabase } from '../lib/supabase';
import { router, Link } from 'expo-router';

const { width } = Dimensions.get('window');

const modules = [
  { id: 'main', title: 'Main Dashboard', color: '#f0f0f0' },
  { id: 'nutrition', title: 'Nutrition', color: '#e3f2fd' },
  { id: 'gym', title: 'Gym', color: '#f3e5f5' },
  { id: 'video', title: 'Video', color: '#e8f5e9' },
];

// Create cyclical data by adding the last item to the start and first item to the end
const cyclicalModules = [
  modules[modules.length - 1],
  ...modules,
  modules[0]
];

export default function HomeScreen() {
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(1); // Start at 1 because of the extra item at start

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleScroll = (event) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / width);
    setCurrentIndex(index);
  };

  const handleMomentumScrollEnd = () => {
    // If we're at the first item (clone), jump to the real first item
    if (currentIndex === 0) {
      flatListRef.current?.scrollToIndex({ index: modules.length, animated: false });
      setCurrentIndex(modules.length);
    }
    // If we're at the last item (clone), jump to the real last item
    else if (currentIndex === modules.length + 1) {
      flatListRef.current?.scrollToIndex({ index: 1, animated: false });
      setCurrentIndex(1);
    }
  };

  const renderModule = ({ item }) => (
    item.id !== 'main' ?
    <View style={[styles.moduleContainer, { backgroundColor: item.color }]}>
      <Link href={item.id} style={styles.moduleTitle}>{item.title}</Link>
      {item.id === 'main' && (
        <Button title="Logout" onPress={handleLogout} />
      )}
    </View>
    :
    <View style={[styles.moduleContainer, { backgroundColor: item.color }]}>
      <Text style={styles.moduleTitle}>{item.title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={cyclicalModules}
        renderItem={renderModule}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        initialScrollIndex={1}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  moduleContainer: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  moduleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
}); 