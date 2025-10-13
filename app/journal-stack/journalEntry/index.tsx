import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
const { width, height } = Dimensions.get('window');
const MINUTE_OPTIONS = Array.from({ length: 301 }, (_, index) => index);
const SECOND_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);

export default function JournalEntryIndex() {
  const { sessionId, sessionDate, sessionType } = useLocalSearchParams();
  const [actions, setActions] = useState<Action[]>([]);
  const [nextId, setNextId] = useState(1);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const timeRegex = /\b\d{1,3}:\d{2}\b/;
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [pickerActionId, setPickerActionId] = useState<number | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  const [selectedSeconds, setSelectedSeconds] = useState(0);


  // Load existing actions for this session
  const loadExistingActions = async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('Actions')
        .select('id, time_stamp, description, sketch_id')
        .eq('session_id', sessionId)
        .order('time_stamp', { ascending: true });

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
      
      if (existingActions.length === 0) {
        const starterAction: Action = {
          id: -1,
          timestamp: "",
          description: "",
          dbId: uuidv4(), 
          sketch_id: uuidv4(),
        }
        existingActions.push(starterAction) 
      }
      
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
      sketch_id: uuidv4(),
    };
    setActions([...actions, newAction]);
    setNextId(nextId + 1);
  };

  const handleSubmitAction = async (action: Action, fromTimeStamp: boolean) => {
    if (!sessionId) {
      Alert.alert('Error', 'No session ID found');
      return;
    }
    if (sessionType !== "note" && !action.timestamp.match(timeRegex) && fromTimeStamp) {
      console.log(fromTimeStamp);
      Alert.alert('Please enter a valid time stamp of the form [minutes:seconds]')
      return;
    }
    try {
      const { data, error } = await supabase
        .from('Actions')
        .upsert([
          {
            id: action.dbId,
            session_id: sessionId,
            time_stamp: action.timestamp,
            description: action.description,
            sketch_id: action.sketch_id,
            session_date: sessionDate
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
    } catch (error) {
      console.error('Error submitting action:', error);
      Alert.alert('Error', 'Failed to submit action');
    }
  };

  const handleDeleteAction = async (action: Action) => {
    Alert.alert(
      'Delete Action',
      'Are you sure you want to delete this action?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            let filter = action.timestamp;
            console.log(action.dbId, typeof(action.dbId));
            try {
              const { data, error } = await supabase
              .from('Actions')
              .delete()
              .eq('id', action.dbId)
              .select();
              console.log(data);
              setActions(actions.filter((a) => a !== action));
            } catch (error) {
              console.error('Error deleting action:', error);
              Alert.alert('Error', 'Failed to delete action');
            }
          }
        }
      ]
    )
  };

  const handleSketchAction = (action: Action) => {
    // Navigate to sketchpad for this action
    router.push({
      pathname: '/journal-stack/journalEntry/sketchpad/new',
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

  const openPickerForAction = (action: Action) => {
    let minutes = 0;
    let seconds = 0;

    if (timeRegex.test(action.timestamp)) {
      const [minutePart, secondPart] = action.timestamp.split(':');
      const parsedMinutes = parseInt(minutePart, 10);
      const parsedSeconds = parseInt(secondPart, 10);

      if (!Number.isNaN(parsedMinutes)) {
        minutes = Math.min(300, Math.max(0, parsedMinutes));
      }

      if (!Number.isNaN(parsedSeconds)) {
        const roundedSeconds = Math.min(55, Math.round(parsedSeconds / 5) * 5);
        seconds = SECOND_OPTIONS.includes(roundedSeconds) ? roundedSeconds : 0;
      }
    }

    setSelectedMinutes(minutes);
    setSelectedSeconds(seconds);
    setPickerActionId(action.id);
    setPickerVisible(true);
  };

  const closePicker = () => {
    setPickerVisible(false);
    setPickerActionId(null);
  };

  const handlePickerConfirm = () => {
    if (pickerActionId == null) {
      closePicker();
      return;
    }

    const targetAction = actions.find(action => action.id === pickerActionId);
    if (!targetAction) {
      closePicker();
      return;
    }

    const formattedSeconds = selectedSeconds.toString().padStart(2, '0');
    const formattedTimestamp = `${selectedMinutes}:${formattedSeconds}`;
    const updatedAction = { ...targetAction, timestamp: formattedTimestamp };

    updateAction(targetAction.id, 'timestamp', formattedTimestamp);
    handleSubmitAction(updatedAction, true);
    closePicker();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  return (
    sessionType === "note" ? 
    <View style={styles.noteContainer}>
      {actions.map((action) => (
        <TextInput
          key={action.id}
          style={styles.noteStyle}
          placeholder=""
          value={action.description}
          onChangeText={(value) => updateAction(action.id, 'description', value)}
          placeholderTextColor="#999"
          multiline={true}
          onBlur={() => handleSubmitAction(action, false)}
        />
      ))}
    </View>
    
    : 
    <View style={styles.container}>
      
      {/* <KeyboardAwareScrollView> */}

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        automaticallyAdjustKeyboardInsets={true}
      >
        {actions.map((action) => (
          <View key={action.id} style={styles.actionContainer}>
            <View style={styles.inputsRow}>
              <TouchableOpacity
                style={styles.timestampInput}
                onPress={() => openPickerForAction(action)}
              >
                <Text style={[styles.timestampText, !action.timestamp && styles.timestampPlaceholder]}>
                  {action.timestamp || '00:00'}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Description of action..."
                value={action.description}
                onChangeText={(value) => updateAction(action.id, 'description', value)}
                placeholderTextColor="#999"
                multiline={true}
                //scrollEnabled={false}
                onBlur={() => handleSubmitAction(action, false)}
              />
              <View style={styles.buttonColumn}>
                <TouchableOpacity 
                  style={styles.sketchButton}
                  onPress={() => handleSketchAction(action)}
                >
                  <Image
                    source={require('../../../assets/images/onwards.png')}
                    style={styles.sketchButtonIcon}
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                style={styles.sketchButton}
                onPress={() => handleDeleteAction(action)}
                >
                <Image
                  source={require('../../../assets/images/trash.png')}
                  style={styles.deleteButtonIcon}
                />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      
      {/* </KeyboardAwareScrollView> */}
      
      
      <View style={styles.bottomButtonsContainer}>       
        <TouchableOpacity style={styles.addButton} onPress={handleAddAction}>
          <Text style={styles.plusSign}>+</Text>
        </TouchableOpacity>
      </View>
      <Modal
        animationType="fade"
        transparent={true}
        visible={isPickerVisible}
        onRequestClose={closePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closePicker}>
                <Text style={styles.modalHeaderText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TouchableOpacity onPress={handlePickerConfirm}>
                <Text style={styles.modalHeaderText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickersRow}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Minutes</Text>
                <Picker
                  selectedValue={selectedMinutes}
                  onValueChange={(value) => setSelectedMinutes(value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {MINUTE_OPTIONS.map(option => (
                    <Picker.Item key={option} label={`${option}`} value={option} />
                  ))}
                </Picker>
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Seconds</Text>
                <Picker
                  selectedValue={selectedSeconds}
                  onValueChange={(value) => setSelectedSeconds(value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {SECOND_OPTIONS.map(option => (
                    <Picker.Item
                      key={option}
                      label={`${option.toString().padStart(2, '0')}`}
                      value={option}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center'
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
    justifyContent: 'center',
  },
  timestampText: {
    color: 'black',
    fontSize: 16,
  },
  timestampPlaceholder: {
    color: '#999',
  },
  descriptionInput: {
    flex: 4,
    //height: 80,
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
    backgroundColor: '#D62C09',
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
    borderColor: 'yellow',
    borderWidth: 1,
  },
  deleteButtonIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  addButton: {
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
    backgroundColor: '#000',
  },
  deleteButton: {
    backgroundColor: '#D62C09',
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
  buttonColumn: {
    flexDirection: "column",
  },
  noteContainer: {
    display: "flex",
    alignItems: "center",
    backgroundColor: 'black',
    height: height,
  },
  noteStyle: {
    width: width*.9,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 10,
    backgroundColor: 'white',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    width: '90%',
    maxWidth: 360,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalHeaderText: {
    color: '#0a84ff',
    fontSize: 16,
  },
  modalTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pickersRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  picker: {
    width: '100%',
  },
  pickerItem: {
    color: 'white',
    fontSize: 18,
  },
}); 
