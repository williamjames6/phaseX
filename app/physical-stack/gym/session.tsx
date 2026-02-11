import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { dateFormatter } from '../../../assets/helpers/dateFormatter';
import { supabase } from '../../../lib/supabase';
import { Exercise } from '../../../types';


interface Session {
  id: string;
  session_date: string;
  data: any; // JSONB data for storing superset information
  note?: string | null;
}

export default function GymSession() {
  const { id, sessionDate } = useLocalSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [supersets, setSupersets] = useState<{ [key: number]: Exercise[] }>({});
  const [loading, setLoading] = useState(true);
  const [currentSuperset, setCurrentSuperset] = useState(1);
  const [isNewSession, setIsNewSession] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const [exercisesList, setExercisesList] = useState<string[]>([]);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [note, setNote] = useState<string>('');


  useEffect(() => {
    if (id) {
      setCurrentSessionId(id as string);
      loadSession();
    } else {
      // New session - create empty superset
      setIsNewSession(true);
      setCurrentSessionId(null);
      setNote('');
      setSupersets({
        1: [createEmptyExercise(1)]
      });
      setLoading(false);
    }
  }, [id]);

  const loadExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('GymExercises')
        .select('exercise')
        .order('exercise', { ascending: true });

      if (error) throw error;
      
      const exerciseNames = data?.map(item => item.exercise) || [];
      setExercisesList(exerciseNames);
    } catch (error) {
      console.error('Error loading exercises:', error);
    }
  };

  const handleOpenExerciseModal = (exerciseId: string) => {
    setCurrentExerciseId(exerciseId);
    setShowExerciseModal(true);
    setShowAddExercise(false);
    setNewExerciseName('');
    loadExercises();
  };

  const handleSelectExercise = async (exerciseName: string) => {
    if (!currentExerciseId) return;

    // Find the exercise before updating state
    let foundExercise: Exercise | null = null;
    let foundSupersetNum: number | null = null;
    
    Object.entries(supersets).forEach(([supersetNum, exercises]) => {
      const exercise = exercises.find(ex => ex.id === currentExerciseId);
      if (exercise) {
        foundExercise = exercise;
        foundSupersetNum = parseInt(supersetNum);
      }
    });

    if (!foundExercise || foundSupersetNum === null) return;

    // Update the exercise (compute next supersets so we can save before state has committed)
    const updatedExercise: Exercise = { ...foundExercise as Exercise, exercise_name: exerciseName };
    const nextSupersets = { ...supersets };
    nextSupersets[foundSupersetNum] = nextSupersets[foundSupersetNum].map(ex =>
      ex.id === currentExerciseId ? updatedExercise : ex
    );

    setSupersets(nextSupersets);

    // Save using the computed next supersets so the backend gets the updated name
    await saveSession(nextSupersets);

    setShowExerciseModal(false);
    setCurrentExerciseId(null);
  };

  const handleAddNewExercise = async () => {
    if (!newExerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    try {
      const { error } = await supabase
        .from('GymExercises')
        .insert([{ exercise: newExerciseName.trim() }]);

      if (error) throw error;

      // Reload exercises list
      await loadExercises();
      
      // Select the newly added exercise
      await handleSelectExercise(newExerciseName.trim());
      
      setShowAddExercise(false);
      setNewExerciseName('');
    } catch (error) {
      console.error('Error adding exercise:', error);
      Alert.alert('Error', 'Failed to add exercise');
    }
  };


  const createEmptyExercise = (supersetNumber: number, exerciseNumber: number = 1): Exercise => ({
    id: `temp-${Date.now()}-${Math.random()}`,
    exercise_name: '',
    superset_number: supersetNumber,
    exercise_number: exerciseNumber,
    sets: [
      { reps: null, weight: null, time: null },
      { reps: null, weight: null, time: null },
      { reps: null, weight: null, time: null }
    ]
  });

  const handleSaveExercise = async (exercise: Exercise) => {
    await saveSession();
  };

  // Memoized pure converters (stable reference across renders)
  const convertSupersetsToJSONB = useCallback((supersets: { [key: number]: Exercise[] }) => {
    const jsonbData: any = {};
    Object.entries(supersets).forEach(([supersetNum, exercises]) => {
      const supersetKey = `superset${supersetNum}`;
      jsonbData[supersetKey] = {};
      exercises.forEach((exercise, exerciseIndex) => {
        const exerciseKey = `exercise${exerciseIndex + 1}`;
        jsonbData[supersetKey][exerciseKey] = {
          exercise_name: exercise.exercise_name,
          sets: {}
        };
        exercise.sets.forEach((set, setIndex) => {
          const setKey = `set${setIndex + 1}`;
          jsonbData[supersetKey][exerciseKey].sets[setKey] = {
            reps: set.reps,
            weight: set.weight,
            time: set.time
          };
        });
      });
    });
    return jsonbData;
  }, []);

  const convertJSONBToSupersets = useCallback((jsonbData: any) => {
    const supersets: { [key: number]: Exercise[] } = {};
    Object.entries(jsonbData).forEach(([supersetKey, supersetData]: [string, any]) => {
      const supersetNum = parseInt(supersetKey.replace('superset', ''));
      supersets[supersetNum] = [];
      Object.entries(supersetData).forEach(([exerciseKey, exerciseData]: [string, any]) => {
        const exerciseNum = parseInt(exerciseKey.replace('exercise', ''));
        const exercise: Exercise = {
          id: `temp-${supersetNum}-${exerciseNum}`,
          exercise_name: exerciseData.exercise_name || '',
          superset_number: supersetNum,
          exercise_number: exerciseNum,
          sets: []
        };
        Object.entries(exerciseData.sets || {}).forEach(([setKey, setData]: [string, any]) => {
          const setNum = parseInt(setKey.replace('set', ''));
          exercise.sets[setNum - 1] = {
            reps: setData.reps,
            weight: setData.weight,
            time: setData.time
          };
        });
        while (exercise.sets.length < 3) {
          exercise.sets.push({ reps: null, weight: null, time: null });
        }
        supersets[supersetNum].push(exercise);
      });
    });
    return supersets;
  }, []);

  /** Single save: use state supersets, or pass explicit supersets when state isn't updated yet. */
  const saveSession = useCallback(async (supersetsOverride?: { [key: number]: Exercise[] }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const toSave = supersetsOverride ?? supersets;
      const jsonbData = convertSupersetsToJSONB(toSave);

      if (isNewSession) {
        const sessionId = uuidv4();
        const { error } = await supabase
          .from('GymSessions')
          .insert({
            id: sessionId,
            user_id: user.id,
            session_date: sessionDate || dateFormatter(new Date()),
            data: jsonbData,
            note: note || null
          });
        if (error) throw error;
        router.setParams({ id: sessionId });
        setCurrentSessionId(sessionId);
        setIsNewSession(false);
      } else {
        const { error } = await supabase
          .from('GymSessions')
          .update({ data: jsonbData, note: note || null })
          .eq('id', currentSessionId);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving session:', error);
      Alert.alert('Error', 'Failed to save session data');
    }
  }, [supersets, isNewSession, currentSessionId, sessionDate, note, convertSupersetsToJSONB]);

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
      
      // Load note
      setNote(sessionData.note || '');

      // Load superset data from JSONB column
      if (sessionData.data && Object.keys(sessionData.data).length > 0) {
        const loadedSupersets = convertJSONBToSupersets(sessionData.data);
        setSupersets(loadedSupersets);
        // Find highest superset number
        const maxSuperset = Math.max(0, ...Object.keys(loadedSupersets).map(Number));
        setCurrentSuperset(maxSuperset + 1);
      } else {
        // If no data, create empty superset
        setSupersets({
          1: [createEmptyExercise(1, 1)]
        });
        setCurrentSuperset(2);
      }
    } catch (error) {
      console.error('Error loading session:', error);
      Alert.alert('Error', 'Failed to load gym session');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExercise = async (targetSupersetNumber?: number) => {

    // Use the target superset number if provided, otherwise use currentSuperset
    const supersetToAddTo = targetSupersetNumber || currentSuperset;
    const currentExercises = supersets[supersetToAddTo] || [];
    const nextExerciseNumber = currentExercises.length + 1;
    const newExercise = createEmptyExercise(supersetToAddTo, nextExerciseNumber);
    setSupersets(prev => ({
      ...prev,
      [supersetToAddTo]: [...(prev[supersetToAddTo] || []), newExercise]
    }));
    
    // Auto-save the new exercise after a short delay to ensure state is updated
    setTimeout(() => {
      handleSaveExercise(newExercise);
    }, 100);
  };

  const handleUpdateSet = (exerciseId: string, supersetNumber: number, setIndex: number, field: 'reps' | 'weight' | 'time', value: any) => {
    setSupersets(prev => {
      const updatedSupersets = {
        ...prev,
        [supersetNumber]: prev[supersetNumber].map(ex => 
          ex.id === exerciseId ? {
            ...ex,
            sets: ex.sets.map((set, index) => 
              index === setIndex ? { ...set, [field]: value } : set
            )
          } : ex
        )
      };
      
      // Save will be triggered by onBlur event
      
      return updatedSupersets;
    });
  };

  const handleAddSet = (exerciseId: string, supersetNumber: number) => {
    setSupersets(prev => ({
      ...prev,
      [supersetNumber]: prev[supersetNumber].map(ex => 
        ex.id === exerciseId ? {
          ...ex,
          sets: [...ex.sets, { reps: null, weight: null, time: null }]
        } : ex
      )
    }));
    
    // Auto-save after adding set with delay to ensure state is updated
    setTimeout(() => {
      saveSession();
    }, 100);
  };

  const handleRemoveSet = (exerciseId: string, supersetNumber: number, setIndex: number) => {
    setSupersets(prev => ({
      ...prev,
      [supersetNumber]: prev[supersetNumber].map(ex => 
        ex.id === exerciseId ? {
          ...ex,
          sets: ex.sets.filter((_, index) => index !== setIndex)
        } : ex
      )
    }));
    
    // Auto-save after removing set with delay to ensure state is updated
    setTimeout(() => {
      saveSession();
    }, 100);
  };

  const handleRemoveExercise = async (exerciseId: string, supersetNumber: number) => {
    const next = {
      ...supersets,
      [supersetNumber]: supersets[supersetNumber].filter(ex => ex.id !== exerciseId)
    };
    setSupersets(next);
    await saveSession(next);
  };

  const handleLongPressExercise = (exerciseId: string, supersetNumber: number) => {
    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to delete this exercise from the superset?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleRemoveExercise(exerciseId, supersetNumber) },
      ]
    );
  };

  const handleDeleteSuperset = async (supersetNumber: number) => {
    Alert.alert(
      'Delete Superset',
      `Are you sure you want to delete Superset ${supersetNumber}? This will permanently remove all exercises in this superset.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Remove superset and renumber remaining
            const newSupersets = { ...supersets };
            delete newSupersets[supersetNumber];
            const sortedKeys = Object.keys(newSupersets).map(Number).sort((a, b) => a - b);
            const renumberedSupersets: { [key: number]: Exercise[] } = {};
            sortedKeys.forEach((oldKey, index) => {
              const newKey = index + 1;
              renumberedSupersets[newKey] = newSupersets[oldKey].map(exercise => ({
                ...exercise,
                superset_number: newKey
              }));
            });
            const maxSuperset = Math.max(0, ...Object.keys(renumberedSupersets).map(Number));
            setSupersets(renumberedSupersets);
            setCurrentSuperset(maxSuperset + 1);
            await saveSession(renumberedSupersets);
          },
        },
      ]
    );
  };

  const saveNote = async (noteText: string) => {
    if (!currentSessionId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const { error } = await supabase
        .from('GymSessions')
        .update({ note: noteText })
        .eq('id', currentSessionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving note:', error);
      }
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const handleAddSuperset = () => {
    // Calculate the next superset number based on existing supersets
    const existingSupersetNumbers = Object.keys(supersets).map(Number);
    const maxSupersetNumber = Math.max(0, ...existingSupersetNumbers);
    const newSupersetNumber = maxSupersetNumber + 1;
    
    setCurrentSuperset(newSupersetNumber);
    setSupersets(prev => ({
      ...prev,
      [newSupersetNumber]: [createEmptyExercise(newSupersetNumber, 1)]
    }));
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
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        //keyboardVerticalOffset={Platform.OS === "ios" ? 200 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Session Header */}
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionDate}>
              {session?.session_date ? session.session_date : 'Today'}
            </Text>
          </View>

          {/* Note Input */}
          <TextInput
            style={styles.noteInput}
            placeholder="Add a note..."
            placeholderTextColor="#999"
            multiline={true}
            scrollEnabled={false}
            value={note}
            onChangeText={setNote}
            onBlur={() => saveNote(note)}
            textAlignVertical="top"
          />

          {/* Supersets */}
          {Object.entries(supersets).map(([supersetNum, supersetExercises]) => (
            <View
              key={supersetNum}
              style={styles.supersetContainer}
            >
              <View style={styles.supersetHeader}>
                <Text style={styles.supersetTitle}># {supersetNum}</Text>
                <TouchableOpacity
                  style={styles.deleteSupersetButton}
                  onPress={() => handleDeleteSuperset(parseInt(supersetNum))}
                >
                  <Text style={styles.deleteSupersetButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              
              {/* Superset Box */}
              <View style={styles.supersetBox}>        
                
                {/* Exercise Rows */}
                {supersetExercises.map((exercise, exerciseIndex) => (
                  <Pressable
                    key={exercise.id}
                    style={styles.exerciseRow}
                    onLongPress={() => handleLongPressExercise(exercise.id, parseInt(supersetNum))}
                    delayLongPress={500}
                  >
                    {/* Exercise Name Column */}
                    <View style={styles.exerciseColumn}>
                      <TouchableOpacity
                        style={styles.exerciseNameInput}
                        onPress={() => handleOpenExerciseModal(exercise.id)}
                      >
                        <Text style={[styles.exerciseNameText, !exercise.exercise_name && styles.exerciseNamePlaceholder]}>
                          {exercise.exercise_name || 'Exercise Name'}
                        </Text>
                      </TouchableOpacity>
                      {/* Add Exercise Button - Only show on last exercise */}
                      {exerciseIndex === supersetExercises.length - 1 && (
                        <TouchableOpacity 
                          style={styles.addExerciseToSupersetButton} 
                          onPress={() => handleAddExercise(parseInt(supersetNum))}
                        >
                          <Text style={styles.plusSign}>+</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    {/* Scrollable Sets Container */}
                    <View style={styles.setsScrollContainer}>
                      <ScrollView 
                        horizontal 
                        style={styles.setsScrollView}
                        showsHorizontalScrollIndicator={false}
                      >
                        <View style={styles.setsContainer}>
                        {exercise.sets.map((set, setIndex) => (
                          <View key={setIndex} style={styles.setColumn}>
                            <View style={styles.setInputs}>
                            <TextInput
                              style={styles.setInput}
                              placeholder="Reps"
                              placeholderTextColor="#666"
                              value={set.reps?.toString() || ''}
                              onChangeText={(value) => handleUpdateSet(exercise.id, parseInt(supersetNum), setIndex, 'reps', value ? parseInt(value) : null)}
                              onBlur={() => handleSaveExercise(exercise)}
                              keyboardType="numeric"
                            />
                            <TextInput
                              style={styles.setInput}
                              placeholder="Weight"
                              placeholderTextColor="#666"
                              value={set.weight?.toString() || ''}
                              onChangeText={(value) => handleUpdateSet(exercise.id, parseInt(supersetNum), setIndex, 'weight', value ? parseFloat(value) : null)}
                              onBlur={() => handleSaveExercise(exercise)}
                              keyboardType="numeric"
                            />
                            <TextInput
                              style={styles.setInput}
                              placeholder="Time"
                              placeholderTextColor="#666"
                              value={set.time?.toString() || ''}
                              onChangeText={(value) => handleUpdateSet(exercise.id, parseInt(supersetNum), setIndex, 'time', value ? parseFloat(value) : null)}
                              onBlur={() => handleSaveExercise(exercise)}
                              keyboardType="numeric"
                            />
                            </View>
                            {/* Remove Set Button */}
                            {exercise.sets.length > 1 && (
                              <TouchableOpacity
                                style={styles.removeSetButton}
                                onPress={() => handleRemoveSet(exercise.id, parseInt(supersetNum), setIndex)}
                              >
                                <Text style={styles.removeSetButtonText}>−</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                        {/* Add Set Button */}
                        <TouchableOpacity
                          style={styles.addSetButton}
                          onPress={() => handleAddSet(exercise.id, parseInt(supersetNum))}
                        >
                          <Text style={styles.addSetButtonText}>+</Text>
                        </TouchableOpacity>
                        </View>
                      </ScrollView>
                    </View>
                    
                    {/* Exercise Action Buttons */}
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        
        {/* Add Superset Button - Pinned to bottom right */}
        <TouchableOpacity style={styles.addSupersetButton} onPress={handleAddSuperset}>
            <Text style={styles.plusSign}>+</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Exercise Selection Modal */}
      <Modal
        visible={showExerciseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowExerciseModal(false);
          setShowAddExercise(false);
          setNewExerciseName('');
          setCurrentExerciseId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Exercise</Text>
            
            {!showAddExercise ? (
              <>
                <ScrollView style={styles.exerciseListContainer}>
                  {exercisesList.map((exerciseName, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.exerciseListItem}
                      onPress={() => handleSelectExercise(exerciseName)}
                    >
                      <Text style={styles.exerciseListItemText}>{exerciseName}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.addExerciseListItem}
                    onPress={() => setShowAddExercise(true)}
                  >
                    <Text style={styles.addExerciseListItemText}>+ Add Exercise</Text>
                  </TouchableOpacity>
                </ScrollView>
                
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowExerciseModal(false);
                    setCurrentExerciseId(null);
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.addExerciseContainer}>
                <Text style={styles.addExerciseTitle}>Add New Exercise</Text>
                <TextInput
                  style={styles.addExerciseInput}
                  placeholder="Exercise Name"
                  placeholderTextColor="#666"
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                  autoFocus={true}
                />
                <View style={styles.addExerciseButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setShowAddExercise(false);
                      setNewExerciseName('');
                    }}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalAddButton}
                    onPress={handleAddNewExercise}
                  >
                    <Text style={styles.modalAddButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sessionHeader: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    flex: 1,
    alignItems: 'center',
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e5e5e5',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 16,
    color: '#FF6B35',
    marginBottom: 8,
  },
  sessionNotes: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  noteInput: {
    width: '100%',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
    color: '#e5e5e5',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  supersetContainer: {
    marginBottom: 20,
  },
  supersetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingLeft: 8,
  },
  supersetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  deleteSupersetButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1a1a1a',
    borderColor: '#FF6B35',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  deleteSupersetButtonText: {
    color: '#FF6B35',
    fontSize: 18,
    fontWeight: 'bold',
  },
  supersetBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingBottom: 8,
    marginBottom: 12,
  },
  exerciseColumn: {
    flex: 2,
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setColumn: {
    flex: 1,
    paddingHorizontal: 4,
  },
  columnHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
    textAlign: 'center',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  exerciseNameInput: {
    fontSize: 16,
    color: '#e5e5e5',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
    minHeight: 20,
    justifyContent: 'center',
  },
  exerciseNameText: {
    fontSize: 16,
    color: '#e5e5e5',
  },
  exerciseNamePlaceholder: {
    color: '#666',
  },
  setsScrollContainer: {
    flex: 8,
    marginHorizontal: 8,
  },
  setsScrollView: {
    flex: 1,
  },
  setsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setInputs: {
    gap: 4,
  },
  setInput: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#1a1a1a',
    color: '#e5e5e5',
    width: 60,
  },
  addSetButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderColor: '#FF6B35',
    borderWidth: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addSetButtonText: {
    color: '#FF6B35',
    fontSize: 18,
    fontWeight: 'bold',
  },
  removeSetButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderColor: '#FF6B35',
    borderWidth: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    alignSelf: 'center',
  },
  removeSetButtonText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseActionButtons: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeExerciseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  removeExerciseButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addExerciseToSupersetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderColor: '#FF6B35',
    borderWidth: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  addSupersetButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderColor: '#FF6B35',
    borderWidth: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  plusSign: {
    color: '#FF6B35',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e5e5e5',
    marginBottom: 16,
    textAlign: 'center',
  },
  exerciseListContainer: {
    maxHeight: 400,
    marginBottom: 16,
  },
  exerciseListItem: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
  },
  exerciseListItemText: {
    fontSize: 16,
    color: '#e5e5e5',
  },
  addExerciseListItem: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#252525',
  },
  addExerciseListItemText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  modalCancelButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#e5e5e5',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addExerciseContainer: {
    width: '100%',
  },
  addExerciseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e5e5e5',
    marginBottom: 16,
    textAlign: 'center',
  },
  addExerciseInput: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
    color: '#e5e5e5',
  },
  addExerciseButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalAddButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalAddButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});