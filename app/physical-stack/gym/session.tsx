import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';

interface Exercise {
  id: string;
  exercise_name: string;
  superset_number: number;
  exercise_number: number;
  sets: {
    reps: number | null;
    weight: number | null;
    time: number | null;
  }[];
}

interface Session {
  id: string;
  session_date: string;
  data: any; // JSONB data for storing superset information
}

export default function GymSession() {
  const { id, sessionDate } = useLocalSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [supersets, setSupersets] = useState<{ [key: number]: Exercise[] }>({});
  const [loading, setLoading] = useState(true);
  const [currentSuperset, setCurrentSuperset] = useState(1);
  const [isNewSession, setIsNewSession] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const setsScrollViewRefs = useRef<{ [key: string]: ScrollView | null }>({});
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});

  useEffect(() => {
    if (id) {
      setCurrentSessionId(id as string);
      loadSession();
    } else {
      // New session - create empty superset
      setIsNewSession(true);
      setCurrentSessionId(null);
      setSupersets({
        1: [createEmptyExercise(1)]
      });
      setLoading(false);
    }
  }, [id]);


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
    // Save the entire session data immediately when any exercise is modified
    await handleSaveSession();
  };

  // Helper functions to convert between flat structure and JSONB structure
  const convertSupersetsToJSONB = (supersets: { [key: number]: Exercise[] }) => {
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
  };

  const convertJSONBToSupersets = (jsonbData: any) => {
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
        
        // Fill in missing sets with null values
        while (exercise.sets.length < 3) {
          exercise.sets.push({ reps: null, weight: null, time: null });
        }
        
        supersets[supersetNum].push(exercise);
      });
    });
    
    return supersets;
  };

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

  const createSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create gym sessions');
        return null;
      }

      const sessionData = {
        user_id: user.id,
        session_date: new Date().toISOString().split('T')[0],
        data: {} // Empty JSONB object initially
      };

      const { data, error } = await supabase
        .from('GymSessions')
        .insert([sessionData])
        .select()
        .single();
      
      if (error) throw error;
      
      setSession(data);
      return data.id;
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create gym session');
      return null;
    }
  };

  const handleAddExercise = async (targetSupersetNumber?: number) => {
    let sessionId = id as string;

    // If no session exists, create one
    if (!sessionId) {
      sessionId = await createSession();
      if (!sessionId) return;
      
      // Update the URL parameters to include the new session ID
      router.setParams({ id: sessionId });
    }

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

  const handleUpdateExercise = (exerciseId: string, supersetNumber: number, field: keyof Exercise, value: any) => {
    setSupersets(prev => {
      const updatedSupersets = {
        ...prev,
        [supersetNumber]: prev[supersetNumber].map(ex => 
          ex.id === exerciseId ? { ...ex, [field]: value } : ex
        )
      };
      
      // Save will be triggered by onBlur event
      
      return updatedSupersets;
    });
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
    
    // Auto-scroll the sets ScrollView to the end
    setTimeout(() => {
      const scrollViewRef = setsScrollViewRefs.current[exerciseId];
      if (scrollViewRef) {
        scrollViewRef.scrollToEnd({ animated: true });
      }
    }, 100);
    
    // Auto-save after adding set with delay to ensure state is updated
    setTimeout(() => {
      handleSaveSession();
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
      handleSaveSession();
    }, 100);
  };

  const handleRemoveExercise = (exerciseId: string, supersetNumber: number) => {
    setSupersets(prev => ({
      ...prev,
      [supersetNumber]: prev[supersetNumber].filter(ex => ex.id !== exerciseId)
    }));
    
    // Auto-save after removing exercise
    setTimeout(() => {
      handleSaveSession();
    }, 100);
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
            // Remove superset from state and renumber remaining supersets
            setSupersets(prev => {
              const newSupersets = { ...prev };
              delete newSupersets[supersetNumber];
              
              // Renumber remaining supersets
              const sortedKeys = Object.keys(newSupersets).map(Number).sort((a, b) => a - b);
              const renumberedSupersets: { [key: number]: Exercise[] } = {};
              
              sortedKeys.forEach((oldKey, index) => {
                const newKey = index + 1;
                renumberedSupersets[newKey] = newSupersets[oldKey].map(exercise => ({
                  ...exercise,
                  superset_number: newKey
                }));
              });
              
              return renumberedSupersets;
            });
            
            // Update currentSuperset to be the next available number
            setSupersets(currentSupersets => {
              const maxSuperset = Math.max(0, ...Object.keys(currentSupersets).map(Number));
              setCurrentSuperset(maxSuperset + 1);
              return currentSupersets;
            });
            
            // Save the updated session data
            handleSaveSession();
            
            console.log(`Superset ${supersetNumber} deleted successfully`);
          },
        },
      ]
    );
  };

  const handleSaveSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const jsonbData = convertSupersetsToJSONB(supersets);
      
      if (isNewSession) {
        // Create new session
        const sessionId = uuidv4();
        const { data, error } = await supabase
          .from('GymSessions')
        .insert({
          id: sessionId,
          user_id: user.id,
          session_date: sessionDate || new Date().toISOString().split('T')[0],
          data: jsonbData
        })
          .select()
          .single();
        
        if (error) throw error;
        
        // Update the URL parameters to include the new session ID
        router.setParams({ id: sessionId });
        setCurrentSessionId(sessionId);
        setIsNewSession(false);
        console.log('New session created successfully');
      } else {
        // Update existing session
        const { error } = await supabase
          .from('GymSessions')
          .update({ data: jsonbData })
          .eq('id', currentSessionId);
        
        if (error) throw error;
        console.log('Session data updated successfully');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      Alert.alert('Error', 'Failed to save session data');
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
    
    console.log(scrollViewRef?.current?.scrollToEnd);
    // Auto-scroll to bottom after adding superset
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const scrollToInput = (inputId: string) => {
    // Find the superset container that contains this input
    const supersetEntries = Object.entries(supersets);
    let targetSupersetIndex = -1;
    
    for (let i = 0; i < supersetEntries.length; i++) {
      const [supersetNum, exercises] = supersetEntries[i];
      const exercise = exercises.find(ex => ex.id === inputId);
      if (exercise) {
        targetSupersetIndex = i;
        break;
      }
    }
    
    if (targetSupersetIndex >= 0) {
      // Calculate scroll position: header (100px) + each superset (~300px) + some padding
      const headerHeight = 100;
      const supersetHeight = 300;
      const estimatedScrollY = headerHeight + (targetSupersetIndex * supersetHeight);
      
      // Use a longer delay to ensure keyboard is fully up
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, estimatedScrollY - 100), // Offset to show some context above
          animated: true
        });
      }, 300);
    }
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
      >
        <ScrollView 
          ref={scrollViewRef} 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Session Header */}
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionTitle}>Gym Session</Text>
            <Text style={styles.sessionDate}>
              {session?.session_date ? new Date(session.session_date).toLocaleDateString() : 'Today'}
            </Text>
          </View>

          {/* Supersets */}
          {Object.entries(supersets).map(([supersetNum, supersetExercises]) => (
            <View key={supersetNum} style={styles.supersetContainer}>
              <View style={styles.supersetHeader}>
                <Text style={styles.supersetTitle}>Superset {supersetNum}</Text>
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
                  <View key={exercise.id} style={styles.exerciseRow}>
                    {/* Exercise Name Column */}
                    <View style={styles.exerciseColumn}>
                    <TextInput
                      ref={(ref) => {
                        if (ref) {
                          inputRefs.current[`${exercise.id}-name`] = ref;
                        }
                      }}
                      style={styles.exerciseNameInput}
                      placeholder="Exercise Name"
                      multiline={true}
                      value={exercise.exercise_name}
                      onChangeText={(value) => handleUpdateExercise(exercise.id, parseInt(supersetNum), 'exercise_name', value)}
                      onBlur={() => handleSaveExercise(exercise)}
                      onFocus={() => scrollToInput(exercise.id)}
                    />
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
                        ref={(ref) => {
                          if (ref) {
                            setsScrollViewRefs.current[exercise.id] = ref;
                          }
                        }}
                      >
                        <View style={styles.setsContainer}>
                        {exercise.sets.map((set, setIndex) => (
                          <View key={setIndex} style={styles.setColumn}>
                            <View style={styles.setInputs}>
                            <TextInput
                              ref={(ref) => {
                                if (ref) {
                                  inputRefs.current[`${exercise.id}-${setIndex}-reps`] = ref;
                                }
                              }}
                              style={styles.setInput}
                              placeholder="Reps"
                              value={set.reps?.toString() || ''}
                              onChangeText={(value) => handleUpdateSet(exercise.id, parseInt(supersetNum), setIndex, 'reps', value ? parseInt(value) : null)}
                              onBlur={() => handleSaveExercise(exercise)}
                              onFocus={() => scrollToInput(exercise.id)}
                              keyboardType="numeric"
                            />
                            <TextInput
                              ref={(ref) => {
                                if (ref) {
                                  inputRefs.current[`${exercise.id}-${setIndex}-weight`] = ref;
                                }
                              }}
                              style={styles.setInput}
                              placeholder="Weight"
                              value={set.weight?.toString() || ''}
                              onChangeText={(value) => handleUpdateSet(exercise.id, parseInt(supersetNum), setIndex, 'weight', value ? parseFloat(value) : null)}
                              onBlur={() => handleSaveExercise(exercise)}
                              onFocus={() => scrollToInput(exercise.id)}
                              keyboardType="numeric"
                            />
                            <TextInput
                              ref={(ref) => {
                                if (ref) {
                                  inputRefs.current[`${exercise.id}-${setIndex}-time`] = ref;
                                }
                              }}
                              style={styles.setInput}
                              placeholder="Time"
                              value={set.time?.toString() || ''}
                              onChangeText={(value) => handleUpdateSet(exercise.id, parseInt(supersetNum), setIndex, 'time', value ? parseFloat(value) : null)}
                              onBlur={() => handleSaveExercise(exercise)}
                              onFocus={() => scrollToInput(exercise.id)}
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
                    {/* <View style={styles.exerciseActionButtons}>
                      <TouchableOpacity
                        style={styles.removeExerciseButton}
                        onPress={() => handleRemoveExercise(exercise.id, parseInt(supersetNum))}
                      >
                        <Text style={styles.removeExerciseButtonText}>−</Text>
                      </TouchableOpacity>
                    </View> */}
                  </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: 100, // Extra padding to ensure plus button doesn't overlap content
  },
  sessionHeader: {
    backgroundColor: '#000000',
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
    color: '#ffffff',
  },
  deleteSupersetButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  deleteSupersetButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  supersetBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#ddd',
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
    color: '#666',
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
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 4,
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
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'white',
    width: 60,
  },
  addSetButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addSetButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  removeSetButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    alignSelf: 'center',
  },
  removeSetButtonText: {
    color: 'white',
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
    backgroundColor: '#ff9800',
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
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  addSupersetButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderColor: 'yellow',
    borderWidth: 1,
    backgroundColor: '#000',
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
    color: 'yellow',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  // bottomButtonsContainer: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'center',
  //   paddingHorizontal: 20,
  //   paddingTop: 20,
  //   paddingBottom: 20,
  //   marginTop: 20,
  //   position: 'absolute',
  //   bottom: 0,
  //   left: 0,
  //   right: 0,
  //   backgroundColor: '#000000',
  // },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 40,
  },
});