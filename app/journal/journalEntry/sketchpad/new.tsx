import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, GestureResponderEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../../../lib/supabase';

const { width, height } = Dimensions.get('window');

interface Sketch {
  id: string;
  paths: string[];
  user_id: string;
}

export default function NewSketchScreen() {
  const params = useLocalSearchParams();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const actionId = params.actionId as string;
  const sessionId = params.sessionId as string;


  useFocusEffect(
    useCallback( () =>
      {
        console.log(new Date());
        console.log(params.sketchId);
        const handleRender = async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              alert('You must be logged in to save sketches');
              return;
            }
            const { data: sketchData, error: sketchError } = await supabase
              .from('TacticalSketches')
              .select('paths')
              .eq('id', params.sketchId)
              .maybeSingle();

            if (sketchError) {
              console.log(sketchData);
              throw sketchError;
            }
            if (sketchData) {
              setPaths(sketchData.paths);
            }
          }
          catch (error: unknown) {
            console.error('Error in handleSave:', error);
            if (error instanceof Error) {
              alert('Error saving sketch: ' + error.message);
            } else {
              alert('An unknown error occurred while saving the sketch');
            }
          }
        };
        console.log("BINGBING");

        handleRender();

        return () => {
          // Do something when the screen is unfocused
          // Useful for cleanup functions
        };
      }, [])
  );

  // Debug: Log the received parameters
  //console.log('Sketchpad received params:', { actionId, sessionId, allParams: params });


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
    if (!actionId || !sessionId) {
      alert('Missing action or session information');
      return;
    }

    if (paths.length === 0) {
      alert('Please draw something before saving');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be logged in to save sketches');
        return;
      }
      // 1. Create new row in TacticalSketches table
      const { data: sketchData, error: sketchError } = await supabase
        .from('TacticalSketches')
        .upsert([
          {
            user_id: user.id,
            paths: paths,
            id: params.sketchId
          }
          ],
          {onConflict: "id"}
        )
        .select()
        .single();

      if (sketchError) throw sketchError;
      console.log('Sketch created successfully:', sketchData.id);

      alert('Sketch saved successfully!');
      
      // Navigate back to the journal entry with the sketch ID
      router.back();
      // Note: The sketch ID will be stored in the action's pendingSketchId field
      // when the user returns to the journal entry
    } catch (error: unknown) {
      console.error('Error in handleSave:', error);
      if (error instanceof Error) {
        alert('Error saving sketch: ' + error.message);
      } else if (typeof(error)=="object" && error) {
        alert("Did you enter a time stamp or description? No? You dumb slut. Do that first before saving a sketch.");
      } else {
        alert('An unknown error occurred while saving the sketch');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.canvas}>
        <Svg
          height={height * 0.6}
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
        <Text style={styles.saveButtonText}>Save Sketch</Text>
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