import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

interface Exercise {
  id: string;
  exercise_name: string;
  weight: number | null;
  sets: number;
  reps: number;
  notes: string | null;
  superset_number: number;
}

interface Session {
  id: string;
  session_date: string;
  session_name: string | null;
  notes: string | null;
}

export default function GymSession() {
  const { id } = useLocalSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [currentSuperset, setCurrentSuperset] = useState(1);

  useEffect(() => {
    if (id) {
      loadSession();
    } else {
      setEditing(true);
      setLoading(false);
    }
  }, [id]);

  const loadSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to view gym sessions');
        return;
      }

      // Load session details
      const { data: sessionData, error: sessionError } = await supabase
        .from('GymSessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);
      setSessionName(sessionData.session_name || '');
      setSessionNotes(sessionData.notes || '');

      // Load exercises
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('GymExercises')
        .select('*')
        .eq('session_id', id)
        .order('superset_number', { ascending: true });

      if (exercisesError) throw exercisesError;
      setExercises(exercisesData || []);

      // Find highest superset number
      const maxSuperset = Math.max(0, ...(exercisesData || []).map(e => e.superset_number));
      setCurrentSuperset(maxSuperset + 1);
    } catch (error) {
      console.error('Error loading session:', error);
      Alert.alert('Error', 'Failed to load gym session');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save gym sessions');
        return;
      }

      const sessionData = {
        user_id: user.id,
        session_date: new Date().toISOString().split('T')[0],
        session_name: sessionName || null,
        notes: sessionNotes || null,
      };

      let sessionId = id as string;

      if (id) {
        // Update existing session
        const { error } = await supabase
          .from('GymSessions')
          .update(sessionData)
          .eq('id', id);
        if (error) throw error;
      } else {
        // Create new session
        const { data, error } = await supabase
          .from('GymSessions')
          .insert([sessionData])
          .select()
          .single();
        if (error) throw error;
        sessionId = data.id;
      }

      Alert.alert('Success', 'Session saved successfully!');
      setEditing(false);
      if (!id) {
        router.replace(`/physical-stack/gym/session?id=${sessionId}`);
      }
    } catch (error) {
      console.error('Error saving session:', error);
      Alert.alert('Error', 'Failed to save gym session');
    }
  };

  const handleAddExercise = () => {
    const newExercise: Omit<Exercise, 'id'> = {
      exercise_name: '',
      weight: null,
      sets: 1,
      reps: 1,
      notes: null,
      superset_number: currentSuperset,
    };
    setExercises(prev => [...prev, { ...newExercise, id: `temp-${Date.now()}` }]);
  };

  const handleUpdateExercise = (exerciseId: string, field: keyof Exercise, value: any) => {
    setExercises(prev => prev.map(ex => 
      ex.id === exerciseId ? { ...ex, [field]: value } : ex
    ));
  };

  const handleSaveExercise = async (exercise: Exercise) => {
    if (!exercise.exercise_name.trim()) {
      Alert.alert('Error', 'Exercise name is required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sessionId = id as string;
      const exerciseData = {
        session_id: sessionId,
        superset_number: exercise.superset_number,
        exercise_name: exercise.exercise_name,
        weight: exercise.weight,
        sets: exercise.sets,
        reps: exercise.reps,
        notes: exercise.notes,
      };

      if (exercise.id.startsWith('temp-')) {
        // Create new exercise
        const { data, error } = await supabase
          .from('GymExercises')
          .insert([exerciseData])
          .select()
          .single();
        if (error) throw error;
        
        setExercises(prev => prev.map(ex => 
          ex.id === exercise.id ? { ...data } : ex
        ));
      } else {
        // Update existing exercise
        const { error } = await supabase
          .from('GymExercises')
          .update(exerciseData)
          .eq('id', exercise.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving exercise:', error);
      Alert.alert('Error', 'Failed to save exercise');
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (exerciseId.startsWith('temp-')) {
      setExercises(prev => prev.filter(ex => ex.id !== exerciseId));
      return;
    }

    try {
      const { error } = await supabase
        .from('GymExercises')
        .delete()
        .eq('id', exerciseId);
      if (error) throw error;
      
      setExercises(prev => prev.filter(ex => ex.id !== exerciseId));
    } catch (error) {
      console.error('Error deleting exercise:', error);
      Alert.alert('Error', 'Failed to delete exercise');
    }
  };

  const handleAddSuperset = () => {
    setCurrentSuperset(prev => prev + 1);
  };

  const groupExercisesBySuperset = () => {
    const grouped: { [key: number]: Exercise[] } = {};
    exercises.forEach(exercise => {
      if (!grouped[exercise.superset_number]) {
        grouped[exercise.superset_number] = [];
      }
      grouped[exercise.superset_number].push(exercise);
    });
    return grouped;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Session Header */}
        <View style={styles.sessionHeader}>
          {editing ? (
            <>
              <TextInput
                style={styles.sessionNameInput}
                placeholder="Session Name (optional)"
                value={sessionName}
                onChangeText={setSessionName}
              />
              <TextInput
                style={styles.sessionNotesInput}
                placeholder="Session Notes (optional)"
                value={sessionNotes}
                onChangeText={setSessionNotes}
                multiline
              />
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveSession}>
                <Text style={styles.saveButtonText}>Save Session</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sessionTitle}>
                {session?.session_name || 'Untitled Session'}
              </Text>
              <Text style={styles.sessionDate}>
                {session?.session_date ? new Date(session.session_date).toLocaleDateString() : 'Today'}
              </Text>
              {session?.notes && (
                <Text style={styles.sessionNotes}>{session.notes}</Text>
              )}
              <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
                <Text style={styles.editButtonText}>Edit Session</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Supersets */}
        {Object.entries(groupExercisesBySuperset()).map(([supersetNum, supersetExercises]) => (
          <View key={supersetNum} style={styles.supersetContainer}>
            <Text style={styles.supersetTitle}>Superset {supersetNum}</Text>
            {supersetExercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <TextInput
                    style={styles.exerciseNameInput}
                    placeholder="Exercise Name"
                    value={exercise.exercise_name}
                    onChangeText={(value) => handleUpdateExercise(exercise.id, 'exercise_name', value)}
                    onBlur={() => handleSaveExercise(exercise)}
                  />
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteExercise(exercise.id)}
                  >
                    <Text style={styles.deleteButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.exerciseDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Weight (lbs):</Text>
                    <TextInput
                      style={styles.detailInput}
                      placeholder="0"
                      value={exercise.weight?.toString() || ''}
                      onChangeText={(value) => handleUpdateExercise(exercise.id, 'weight', value ? parseFloat(value) : null)}
                      onBlur={() => handleSaveExercise(exercise)}
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Sets:</Text>
                    <TextInput
                      style={styles.detailInput}
                      value={exercise.sets.toString()}
                      onChangeText={(value) => handleUpdateExercise(exercise.id, 'sets', parseInt(value) || 1)}
                      onBlur={() => handleSaveExercise(exercise)}
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reps:</Text>
                    <TextInput
                      style={styles.detailInput}
                      value={exercise.reps.toString()}
                      onChangeText={(value) => handleUpdateExercise(exercise.id, 'reps', parseInt(value) || 1)}
                      onBlur={() => handleSaveExercise(exercise)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Add Exercise Button */}
        <TouchableOpacity style={styles.addExerciseButton} onPress={handleAddExercise}>
          <Text style={styles.addExerciseButtonText}>+ Add Exercise to Superset {currentSuperset}</Text>
        </TouchableOpacity>

        {/* Add Superset Button */}
        <TouchableOpacity style={styles.addSupersetButton} onPress={handleAddSuperset}>
          <Text style={styles.addSupersetButtonText}>+ Add New Superset</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  sessionHeader: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  sessionNotes: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  sessionNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  sessionNotesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: 'white',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  supersetContainer: {
    marginBottom: 20,
  },
  supersetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingLeft: 8,
  },
  exerciseCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseNameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 4,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  exerciseDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    minWidth: 80,
  },
  detailInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    width: 80,
    textAlign: 'center',
    backgroundColor: 'white',
  },
  addExerciseButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addExerciseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  addSupersetButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  addSupersetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 40,
  },
});
