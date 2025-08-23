import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, GestureResponderEvent, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../../../lib/supabase';

const { width, height } = Dimensions.get('window');

interface Sketch {
  id: string;
  title: string;
  description: string;
  paths: string[];
  created_at: string;
  user_id: string;
}

export default function NewSketchScreen() {
  const params = useLocalSearchParams();
  const [title, setTitle] = useState(params.title as string || '');
  const [description, setDescription] = useState(params.description as string || '');
  const [paths, setPaths] = useState<string[]>(params.paths ? JSON.parse(params.paths as string) : []);
  const [currentPath, setCurrentPath] = useState('');
  const [isEditing] = useState(!!params.sketchId);

  const handleTouchStart = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setCurrentPath(`M ${locationX} ${locationY}`);
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setCurrentPath(prev => `${prev} L ${locationX} ${locationY}`);
  };

  const handleTouchEnd = () => {
    if (currentPath) {
      setPaths(prev => [...prev, currentPath]);
      setCurrentPath('');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be logged in to save sketches');
        return;
      }

      if (isEditing) {
        const { error } = await supabase
          .from('TacticalSketches')
          .update({
            title: title,
            description: description,
            paths: paths,
          })
          .eq('id', params.sketchId);

        if (error) throw error;
        alert('Sketch updated successfully!');
      } else {
        const { error } = await supabase
          .from('TacticalSketches')
          .insert([
            {
              title: title,
              description: description,
              paths: paths,
              created_at: new Date().toISOString(),
              user_id: user.id
            }
          ]);

        if (error) throw error;
        alert('Sketch saved successfully!');
      }

      // Navigate back to index and refresh
      router.replace({
        pathname: '/journal/sketchpad',
        params: { refresh: Date.now().toString() }
      });
    } catch (error: unknown) {
      console.error('Error in handleSave:', error);
      if (error instanceof Error) {
        alert('Error saving sketch: ' + error.message);
      } else {
        alert('An unknown error occurred while saving the sketch');
      }
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.titleInput}
        placeholder="Enter sketch title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.titleInput, styles.descriptionInput]}
        placeholder="Enter sketch description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />
      <View style={styles.canvas}>
        <Svg
          height={height * 0.4}
          width={width}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {paths.map((path, index) => (
            <Path
              key={index}
              d={path}
              stroke="black"
              strokeWidth={2}
              fill="none"
            />
          ))}
          {currentPath ? (
            <Path
              d={currentPath}
              stroke="black"
              strokeWidth={2}
              fill="none"
            />
          ) : null}
        </Svg>
      </View>
      <TouchableOpacity 
        style={styles.saveButton} 
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>
          {isEditing ? 'Update Sketch' : 'Save Sketch'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff3e0',
    padding: 20,
  },
  titleInput: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  canvas: {
    backgroundColor: 'white',
    borderRadius: 5,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#ff9800',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 