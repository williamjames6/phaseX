import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';

interface Action {
  id: number;
  timestamp: string;
  description: string;
  dbId: string; // Store the actual database UUID for submitted actions
  sketch_id: string; // Store sketch ID that needs to be linked when action is submitted
}

export default function JournalEntryIndex() {
  const { sessionId } = useLocalSearchParams();
  const [actions, setActions] = useState<Action[]>([]);
  const [nextId, setNextId] = useState(1);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  // Load existing actions for this session
  const loadExistingActions = async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('Actions')
        .select('id, time_stamp, description, sketch_id')
        .eq('session_id', sessionId)
        .order('id', { ascending: true });

      if (error) {
        console.error('Error loading actions:', error);
        return;
      }

      // Convert database actions to local action format
      const existingActions: Action[] = (data || []).map((dbAction, index) => ({
        id: -(index + 1), // Use negative IDs to avoid conflicts with new actions
        timestamp: dbAction.time_stamp,
        description: dbAction.description,
        dbId: dbAction.id, // Store the actual database ID
        sketch_id: dbAction.sketch_id 
      }));

      setActions(existingActions);
      setNextId(Math.abs(existingActions.length) + 1); // Set next ID after existing actions
    } catch (error) {
      console.error('Error loading existing actions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExistingActions();
  }, [sessionId]);

  const handleAddAction = () => {
    const newAction: Action = {
      id: nextId,
      timestamp: '',
      description: '',
      dbId: uuidv4(),
      sketch_id: uuidv4()
    };
    console.log(newAction);
    setActions([...actions, newAction]);
    setNextId(nextId + 1);
  };

  const handleSubmitAction = async (action: Action) => {
    if (!sessionId) {
      Alert.alert('Error', 'No session ID found');
      return;
    }

    // if (!action.timestamp.trim() || !action.description.trim()) {
    //   Alert.alert('Error', 'Please fill in both time and description');
    //   return;
    // }

    try {
      const { data, error } = await supabase
        .from('Actions')
        .upsert([
          {
            id: action.dbId,
            session_id: sessionId,
            time_stamp: action.timestamp,
            description: action.description,
            sketch_id: action.sketch_id
          }
          ],
          {onConflict: 'id'}
        )
        .select();

      if (error) {
        console.error('Error submitting action:', error);
        Alert.alert('Error', 'Failed to submit action');
        return;
      }
      
      action.sketch_id=data[0].sketch_id;
      
      //const actionDbId = data[0].id;
      
      // If there's a pending sketch, link it to this action
      // if (action.pendingSketchId) {
      //   try {
      //     const { error: sketchLinkError } = await supabase
      //       .from('Actions')
      //       .update({
      //         sketch_id: action.pendingSketchId
      //       })
      //       .eq('id', actionDbId);

      //     if (sketchLinkError) {
      //       console.error('Error linking sketch to action:', sketchLinkError);
      //       // Don't fail the action submission, just log the error
      //     } else {
      //       console.log('Sketch linked to action successfully');
      //     }
      //   } catch (sketchError) {
      //     console.error('Error linking sketch:', sketchError);
      //   }
      // }
      
      // Mark the action as submitted instead of removing it
    //   setActions(actions.map(a => 
    //     a.id === action.id ? { ...a, isSubmitted: true, dbId: actionDbId } : a
    //   ));
    } catch (error) {
      console.error('Error submitting action:', error);
      Alert.alert('Error', 'Failed to submit action');
    }
  };

  const handleSketchAction = (action: Action) => {
    // Navigate to sketchpad for this action
    router.push({
      pathname: '/journal/journalEntry/sketchpad/new',
      params: {
        actionId: action.id.toString(), // Use local ID for navigation
        sessionId: sessionId as string,
        sketchId: action.sketch_id.toString()
      }
    });
  };

  // Auto-scroll to bottom when new action is added
  useEffect(() => {
    if (actions.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100); // Small delay to ensure the new action is rendered
    }
  }, [actions.length]);

  const updateAction = (id: number, field: 'timestamp' | 'description', value: string) => {
    setActions(actions.map(action => 
      action.id === id ? { ...action, [field]: value } : action
    ));
  };

  const handleDeleteSession = async () => {
    if (!sessionId) {
      Alert.alert('Error', 'No session ID found');
      return;
    }

    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This will permanently remove the session and all its actions.',
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
              // First delete all actions for this session
              const { error: actionsError } = await supabase
                .from('Actions')
                .delete()
                .eq('session_id', sessionId);

              if (actionsError) {
                console.error('Error deleting actions:', actionsError);
                Alert.alert('Error', 'Failed to delete actions');
                return;
              }

              // Then delete the session
              const { error: sessionError } = await supabase
                .from('Sessions')
                .delete()
                .eq('id', sessionId);

              if (sessionError) {
                console.error('Error deleting session:', sessionError);
                Alert.alert('Error', 'Failed to delete session');
                return;
              }

              console.log('Session and actions deleted successfully');
              Alert.alert('Success', 'Session deleted successfully');
              
              // Navigate back to journal index
              router.back();
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
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
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
      >
        {actions.map((action) => (
          <View key={action.id} style={styles.actionContainer}>
            <View style={styles.inputsRow}>
              <TextInput
                style={styles.timestampInput}
                placeholder="00:00"
                value={action.timestamp}
                onChangeText={(value) => updateAction(action.id, 'timestamp', value)}
                placeholderTextColor="#999"
                onBlur={() => handleSubmitAction(action)}
              />
              <TextInput
                style={styles.descriptionInput}
                placeholder="Description of action..."
                value={action.description}
                onChangeText={(value) => updateAction(action.id, 'description', value)}
                placeholderTextColor="#999"
                multiline
                onBlur={() => handleSubmitAction(action)}
              />
              <TouchableOpacity 
                style={styles.sketchButton}
                onPress={() => handleSketchAction(action)}
              >
                <Image
                  source={require('../../../assets/images/onwards.png')}
                  style={styles.sketchButtonIcon}
                />
              </TouchableOpacity>

              {/* <TouchableOpacity 
                  style={styles.submitButton}
                  onPress={() => handleSubmitAction(action)}
                >
                  <Text style={styles.submitButtonText}>Save</Text>
              </TouchableOpacity> */}

            </View>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.bottomButtonsContainer}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteSession}>
          <Text style={styles.deleteButtonText}>Delete Session</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.addButton} onPress={handleAddAction}>
          <Text style={styles.plusSign}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff3e0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Extra padding to ensure plus button doesn't overlap content
  },
  actionContainer: {
    flexDirection: 'column', // Changed from 'row' to 'column'
    width: '100%',
    marginBottom: 15,
    gap: 15, // Added gap between inputs and button
  },
  inputsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 5,
  },
  timestampInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    fontSize: 16,
  },
  descriptionInput: {
    flex: 3,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  submitButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    // marginTop: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 15,
    marginTop: 15,
  },
  sketchButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#2196f3',
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
  sketchButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },


  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff9800',
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
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  loadingText: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 50,
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff3e0',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 