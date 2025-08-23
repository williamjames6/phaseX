import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../../../lib/supabase';

interface Sketch {
  id: string;
  title: string;
  description: string;
  paths: string[];
  created_at: string;
  user_id: string;
}

export default function SketchpadIndex() {
  const params = useLocalSearchParams();
  const [recentSketches, setRecentSketches] = useState<Sketch[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRecentSketches = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to view sketches');
        return;
      }

      const { data, error } = await supabase
        .from('TacticalSketches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      
      if (data) {
        for (let i = 0; i < data.length; i++) console.log(data[i].created_at);
        setRecentSketches(data);
      }
    } catch (error) {
      console.error('Error loading sketches:', error);
      Alert.alert('Error', 'Failed to load sketches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecentSketches();
  }, [params.refresh]);

  const handleSketchPress = (sketch: Sketch) => {
    router.push({
      pathname: '/journal/sketchpad/new',
      params: { 
        sketchId: sketch.id,
        title: sketch.title,
        description: sketch.description,
        paths: JSON.stringify(sketch.paths)
      }
    });
  };

  const handleDeleteSketch = async (sketch: Sketch) => {
    Alert.alert(
      'Delete Sketch',
      `Are you sure you want to delete "${sketch.title}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('TacticalSketches')
                .delete()
                .eq('id', sketch.id);

              if (error) throw error;

              // Remove the sketch from the local state
              setRecentSketches(prevSketches => 
                prevSketches.filter(s => s.id !== sketch.id)
              );

              Alert.alert('Success', 'Sketch deleted successfully');
            } catch (error) {
              console.error('Error deleting sketch:', error);
              Alert.alert('Error', 'Failed to delete sketch');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Link href="/journal/sketchpad/new" asChild>
        <TouchableOpacity style={styles.newSketchButton}>
          <Text style={styles.newSketchButtonText}>New Sketch</Text>
        </TouchableOpacity>
      </Link>

      <View style={styles.recentSketchesContainer}>
        <Text style={styles.recentSketchesTitle}>Recent Sketches</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recentSketches.length > 0 ? (
            recentSketches.map((sketch) => (
              <View key={sketch.id} style={styles.thumbnailContainer}>
                <TouchableOpacity
                  style={styles.thumbnail}
                  onPress={() => handleSketchPress(sketch)}
                >
                  <Svg height={100} width={100}>
                    {sketch.paths.map((path, index) => (
                      <Path
                        key={index}
                        d={path}
                        stroke="black"
                        strokeWidth={1}
                        fill="none"
                      />
                    ))}
                  </Svg>
                  <Text style={styles.thumbnailTitle} numberOfLines={1}>
                    {sketch.title}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteSketch(sketch)}
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.noSketchesText}>No sketches yet</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff3e0',
    padding: 20,
  },
  newSketchButton: {
    backgroundColor: '#ff9800',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  newSketchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recentSketchesContainer: {
    marginBottom: 20,
  },
  recentSketchesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 10,
  },
  thumbnail: {
    width: 100,
    height: 120,
    backgroundColor: 'white',
    borderRadius: 5,
    padding: 5,
    alignItems: 'center',
  },
  thumbnailTitle: {
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    backgroundColor: '#ff5252',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  noSketchesText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
}); 