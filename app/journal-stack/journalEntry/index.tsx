import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { OpenAI } from 'openai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { timeSwitch } from '../../../assets/helpers/timeSwitch';
import { supabase } from '../../../lib/supabase';

interface Action {
  id: number;
  timestamp: string | number;
  description: string;
  dbId: string; // Store the actual database UUID for submitted actions
  sketch_id: string; // Store sketch ID that needs to be linked when action is submitted
  physical_score?: number; // For training sessions (1-10)
  mental_score?: number; // For training sessions (1-10)
  overall_score?: number; // For training sessions (1-10)
}
const { width, height } = Dimensions.get('window');
const MINUTE_OPTIONS = Array.from({ length: 301 }, (_, index) => index);
const SECOND_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);


const client = new OpenAI({
  apiKey: Constants.expoConfig?.extra?.openaiApiKey,
  dangerouslyAllowBrowser: true // Required for Expo/React Native
});

export default function JournalEntryIndex() {
  const { sessionId, sessionDate, sessionType } = useLocalSearchParams();
  const [actions, setActions] = useState<Action[]>([]);
  const [nextId, setNextId] = useState(1);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const noteScrollViewRef = useRef<ScrollView>(null);
  const textInputRefs = useRef<{ [key: string]: TextInput | null }>({});
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [pickerActionId, setPickerActionId] = useState<number | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  const [selectedSeconds, setSelectedSeconds] = useState(0);
  const [sketchesWithPaths, setSketchesWithPaths] = useState<Set<string>>(new Set());
  const [playerList, setPlayerList] = useState<string[]>([]);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);
  const [validTimestamps, setValidTimestamps] = useState<string[]>([]);
  let actionAdder = 0;



  const playerUpdate = async () => {
    try {
      const { data, error } = await supabase
      .from('Sessions')
      .update({player_mentions: playerList})
      .eq('id', sessionId);

    } catch (error) {
      Alert.alert('Error');
    };
    };

  useEffect(() => {
    playerUpdate();
  }, [playerList]);

  // Load existing actions for this session
  const loadExistingActions = async () => {
    if (!sessionId) return;

    try {
      // Handle note type sessions differently
      if (sessionType === "note") {
        const { data, error } = await supabase
          .from('Actions')
          .select('id, description, sketch_id')
          .eq('session_id', sessionId)
          .is('time_stamp_seconds', null);

        if (error) {
          console.error('Error loading note actions:', error);
          return;
        }

        // Convert database actions to local action format for notes
        const existingActions: Action[] = (data || []).map((dbAction, index) => ({
          id: -(index + 1), // Use negative IDs to avoid conflicts with new actions
          timestamp: "", // No timestamp for note actions
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
        setNextId(Math.abs(existingActions.length) + 1);
      } else if (sessionType === "training") {
        // Load training session scores and actions
        const { data: sessionData, error: sessionError } = await supabase
          .from('Sessions')
          .select('physical_score, mental_score, overall_score')
          .eq('id', sessionId)
          .single();

        const { data: actionsData, error: actionsError } = await supabase
          .from('Actions')
          .select('id, time_stamp_seconds, description, sketch_id')
          .eq('session_id', sessionId)
          .order('time_stamp_seconds', { ascending: true });

        if (actionsError) {
          console.error('Error loading actions:', actionsError);
          return;
        }

        // Create first action with training scores
        const firstAction: Action = {
          id: -1,
          timestamp: "",
          description: "",
          dbId: uuidv4(),
          sketch_id: uuidv4(),
          physical_score: sessionData?.physical_score || undefined,
          mental_score: sessionData?.mental_score || undefined,
          overall_score: sessionData?.overall_score || undefined,
        };

        // Convert database actions to local action format
        const existingActions: Action[] = [firstAction];
        
        if (actionsData && actionsData.length > 0) {
          const otherActions: Action[] = actionsData.map((dbAction, index) => ({
            id: -(index + 2), // Start from -2 since -1 is the first action
            timestamp: timeSwitch(dbAction.time_stamp_seconds),
            description: dbAction.description,
            dbId: dbAction.id,
            sketch_id: dbAction.sketch_id
          }));
          existingActions.push(...otherActions);
        }
        
        setActions(existingActions);
        setNextId(Math.abs(existingActions.length) + 1);
      } else {
        // Handle regular sessions with timestamps
        const { data, error } = await supabase
          .from('Actions')
          .select('id, time_stamp_seconds, description, sketch_id')
          .eq('session_id', sessionId)
          .order('time_stamp_seconds', { ascending: true });

        if (error) {
          console.error('Error loading actions:', error);
          return;
        }
        
        // Convert database actions to local action format
        const existingActions: Action[] = (data || []).map((dbAction, index) => ({
          id: -(index + 1), // Use negative IDs to avoid conflicts with new actions
          timestamp: timeSwitch(dbAction.time_stamp_seconds),
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
      }
    } catch (error) {
      console.error('Error loading existing actions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExistingActions();
  }, [sessionId]);

  // Load player mentions on component mount
  const loadExistingPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('Sessions')
        .select('player_mentions')
        .eq('id', sessionId);

      if (error) {
        console.error('Error loading player mentions:', error);
        return;
      }

      if (data) {
        const names = data[0].player_mentions;
        setPlayerList(names);
      }
    } catch (error) {
      console.error('Error loading player mentions:', error);
    }
  };

  useEffect(() => {
    loadExistingPlayers();
  }, []);

  // Check sketch paths when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const checkSketchPaths = async () => {
        if (actions.length === 0) return;

        const sketchIds = actions
          .map(action => action.sketch_id)
          .filter(id => id && id !== '');

        if (sketchIds.length === 0) return;

        try {
          const { data: sketchesData, error } = await supabase
            .from('TacticalSketches')
            .select('id, paths, grey_paths')
            .in('id', sketchIds);

          if (error) {
            console.error('Error checking sketch paths:', error);
            return;
          }

          const sketchesWithPathsSet = new Set<string>();
          
          if (sketchesData) {
            sketchesData.forEach(sketch => {
              const hasPaths = (sketch.paths && sketch.paths.length > 0) || 
                              (sketch.grey_paths && sketch.grey_paths.length > 0);
              if (hasPaths) {
                sketchesWithPathsSet.add(sketch.id);
              }
            });
          }

          setSketchesWithPaths(sketchesWithPathsSet);
        } catch (error) {
          console.error('Error checking sketch paths:', error);
        }
      };

      checkSketchPaths();
    }, [actions])
  );


  // Helper function to parse player mentions from description
  const parsePlayerMentions = (description: string): string => {
    const mentionRegex = /@([a-zA-Z]+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(description)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions.join(' ');
  };

  // Function to update valid timestamps array based on current action
  const updateValidTimestamps = (currentActionId: number) => {
    const otherActions = actions.filter(action => action.id !== currentActionId);
    const timestamps = otherActions
      .map(action => action.timestamp)
      .filter(timestamp => timestamp && timestamp !== '' && typeof timestamp === 'string')
      .map(timestamp => timestamp as string);
    setValidTimestamps(timestamps);
    console.log(timestamps);
  };

  // Helper function to parse time mentions from description
  const parseTimeMentions = (description: string): number[] => {
    const timeMentionRegex = /\[(\d{1,3}:\d{2})\]/g;
    const mentions: number[] = [];
    let match;
    
    while ((match = timeMentionRegex.exec(description)) !== null) {
      const timestampString = match[1];
      const seconds = timeSwitch(timestampString);
      if (typeof seconds === 'number') {
        mentions.push(seconds);
      }
    }
    
    return mentions;
  };

  // Helper function to add new player to playerMentions table
  const addNewPlayer = async (playerName: string) => {
    if (!playerName || playerName.trim() === '') return;
    
    // Check if player already exists in playerList
    if (playerList.includes(playerName)) {
      return;
    }
    // Update playerList state
    console.log("update should trigger now with: ", playerName);
    setPlayerList(prev => [...prev, playerName]);
    console.log(playerList);

  };

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
    actionAdder++;
  };

  const handleSubmitAction = async (action: Action, fromTimeStamp: boolean) => {
    if (!sessionId) {
      Alert.alert('Error', 'No session ID found');
      return;
    }
    
    try {

      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: action.description,
      });

      if (!response) return;
      // Handle note type sessions differently
      if (sessionType === "note") {
        // For note sessions, only save id, description, and sketch_id
        const actionData = {
          id: action.dbId,
          session_id: sessionId,
          description: action.description,
          sketch_id: action.sketch_id,
          description_embedding: response.data[0].embedding,
          player_mentions: parsePlayerMentions(action.description),
          time_stamp_seconds: null, // Explicitly set to null for note actions
          ...(sessionDate && sessionDate !== 'null' ? { session_date: sessionDate } : {})
        };

        const { data, error } = await supabase
          .from('Actions')
          .upsert([actionData], {onConflict: 'id'})
          .select();

        if (error) {
          console.error('Error submitting note action:', error);
          Alert.alert('Error', 'Failed to submit action');
          return;
        }
        
        action.sketch_id = data[0].sketch_id;
      } else {
        // Handle regular sessions with timestamps
        // Check if this is a Master session (no date)
        //const isMasterSession = !sessionDate || sessionDate === 'null' || sessionDate === null;
        const isTypeOther = sessionType === "other";
        
        
        const actionData = {
          id: action.dbId,
          session_id: sessionId,
          time_stamp_seconds: timeSwitch(action.timestamp),
          description: action.description,
          description_embedding: response.data[0].embedding,
          player_mentions: parsePlayerMentions(action.description),
          sketch_id: action.sketch_id,
          self: !isTypeOther,
          session_date: sessionDate,
          //...(isMasterSession ? {} : { session_date: sessionDate })
        };

        const { data, error } = await supabase
          .from('Actions')
          .upsert([actionData], {onConflict: 'id'})
          .select();

        if (error) {
          console.error('Error submitting action:', error);
          Alert.alert('Error', 'Failed to submit action');
          return;
        }
        
        action.sketch_id = data[0].sketch_id;
      }
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
  }, [actionAdder]);

  const updateAction = (id: number, field: 'timestamp' | 'description' | 'physical_score' | 'mental_score' | 'overall_score', value: string | number) => {
    // For score fields, validate and convert to number (1-10)
    if (field === 'physical_score' || field === 'mental_score' || field === 'overall_score') {
      if (value === '' || value === null || value === undefined) {
        // Allow clearing the value
        setActions(actions.map(action => 
          action.id === id ? { ...action, [field]: undefined } : action
        ));
        return;
      }
      const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
      if (isNaN(numValue) || numValue < 1 || numValue > 10) {
        return; // Don't update if invalid
      }
      setActions(actions.map(action => 
        action.id === id ? { ...action, [field]: numValue } : action
      ));
      return;
    }
    
    // For description field, handle player mention tracking and time mention validation
    if (field === 'description' && typeof value === 'string') {
      const description = value;
      const lastChar = description.length > 0 ? description[description.length - 1] : '';
      
      // Check if last character is "@"
      if (lastChar === '@') {
        setTypingPlayer('');
      }
      // Check if we're in the middle of typing a player mention
      else if (typingPlayer !== null) {
        // Find the last @ symbol and extract the player name after it
        const lastAtIndex = description.lastIndexOf('@');
        if (lastAtIndex !== -1) {
          const afterAt = description.substring(lastAtIndex + 1);
          // Check if the text after @ is all alphabetic (still typing the name)
          if (/^[a-zA-Z]*$/.test(afterAt)) {
            setTypingPlayer(afterAt);
          }
          // If there's a non-alphabetic character, the player name is complete
          else {
            const playerNameMatch = afterAt.match(/^([a-zA-Z]+)/);
            if (playerNameMatch && playerNameMatch[1]) {
              addNewPlayer(playerNameMatch[1]);
            }
            setTypingPlayer(null);
          }
        } else {
          // No @ found, reset tracking
          if (typingPlayer !== '') {
            addNewPlayer(typingPlayer);
          }
          setTypingPlayer(null);
        }
      }

      // Check if last character is "]" for time mention validation
      if (lastChar === ']') {
        // Find the most recent [mm:ss] or [mmm:ss] pattern before the ]
        const lastBracketIndex = description.lastIndexOf('[');
        if (lastBracketIndex !== -1) {
          const bracketContent = description.substring(lastBracketIndex + 1, description.length - 1);
          // Check if it matches the pattern mm:ss or mmm:ss
          const timePattern = /^(\d{2,3}:\d{2})$/;
          if (timePattern.test(bracketContent)) {
            // Validate against validTimestamps array
            if (!validTimestamps.includes(bracketContent)) {
              Alert.alert('Please enter a valid time stamp');
            }
          }
        }
      }
    }
    
    // For other fields, update as string
    setActions(actions.map(action => 
      action.id === id ? { ...action, [field]: value } : action
    ));
  };

  const handleSaveTrainingScores = async (action: Action) => {
    if (!sessionId) return;
    
    try {
      const { error } = await supabase
        .from('Sessions')
        .update({
          physical_score: action.physical_score || null,
          mental_score: action.mental_score || null,
          overall_score: action.overall_score || null,
        })
        .eq('id', sessionId);
      
      if (error) {
        console.error('Error saving training scores:', error);
      }
    } catch (error) {
      console.error('Error saving training scores:', error);
    }
  };

  const scrollToTextInput = (actionId: number) => {
    // Find the index of the action in the actions array
    const actionIndex = actions.findIndex(action => action.id === actionId);
    
    if (actionIndex >= 0) {
      // Calculate approximate scroll position based on action index
      // Each note TextInput is roughly 100px tall with margins
      const estimatedScrollY = actionIndex * 120;
      
      setTimeout(() => {
        noteScrollViewRef.current?.scrollTo({
          y: Math.max(0, estimatedScrollY - 100), // Offset to show some context above
          animated: true
        });
      }, 300);
    }
  };

  const handleTextInputTap = (actionId: number) => {
    scrollToTextInput(actionId);
    // Focus the TextInput after a short delay
    setTimeout(() => {
      const textInput = textInputRefs.current[actionId.toString()];
      if (textInput) {
        textInput.focus();
      }
    }, 100);
  };

  const openPickerForAction = (action: Action) => {
    let minutes = 0;
    let seconds = 0;

    // if (timeRegex.test(action.timestamp)) {
    const [minutePart, secondPart] = action.timestamp.toString().split(':');
    const parsedMinutes = parseInt(minutePart, 10);
    const parsedSeconds = parseInt(secondPart, 10);

    if (!Number.isNaN(parsedMinutes)) {
      minutes = Math.min(300, Math.max(0, parsedMinutes));
    }

    if (!Number.isNaN(parsedSeconds)) {
      const roundedSeconds = Math.min(55, Math.round(parsedSeconds / 5) * 5);
      seconds = SECOND_OPTIONS.includes(roundedSeconds) ? roundedSeconds : 0;
    }
    // }

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
    <View style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView 
          ref={noteScrollViewRef}
          style={styles.noteScrollView}
          contentContainerStyle={styles.noteScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {actions.map((action) => (
            <TouchableWithoutFeedback
              key={action.id}
              onPress={() => handleTextInputTap(action.id)}
            >
              <TextInput
                ref={(ref) => {
                  if (ref) {
                    textInputRefs.current[action.id.toString()] = ref;
                  }
                }}
                style={styles.noteStyle}
                placeholder=""
                value={action.description}
                onChangeText={(value) => updateAction(action.id, 'description', value)}
                placeholderTextColor="#999"
                multiline={true}
                scrollEnabled={false}
                onFocus={() => {
                  updateValidTimestamps(action.id);
                }}
                onBlur={async () => {
                  if (typingPlayer !== null && typingPlayer !== '') {
                    addNewPlayer(typingPlayer);
                    setTypingPlayer(null);
                  }
                  handleSubmitAction(action, false);
                }}
                // onSelectionChange={() => {
                //   if (typingPlayer !== null && typingPlayer !== '') {
                //     addNewPlayer(typingPlayer);
                //     setTypingPlayer(null);
                //   }
                // }}
              />
            </TouchableWithoutFeedback>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
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
        {actions.map((action, index) => (
          <View key={action.id} style={styles.actionContainer}>
            {sessionType !== "other" && index === 0 ? (
              <View style={styles.trainingInputsRow}>
                <View style={styles.trainingInputContainer}>
                  <Text style={styles.trainingInputLabel}>Physical</Text>
                  <TextInput
                    style={styles.trainingInputCircle}
                    placeholder=""
                    value={action.physical_score?.toString() || ''}
                    onChangeText={(value) => {
                      // Only allow single digits 1-10
                      if (value === '' || (value.length === 1 && /^[1-9]$/.test(value)) || (value.length === 2 && value === '10')) {
                        updateAction(action.id, 'physical_score', value);
                      }
                    }}
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={2}
                    textAlign="center"
                    onBlur={() => handleSaveTrainingScores(action)}
                  />
                </View>
                <View style={styles.trainingInputContainer}>
                  <Text style={styles.trainingInputLabel}>Mental</Text>
                  <TextInput
                    style={styles.trainingInputCircle}
                    placeholder=""
                    value={action.mental_score?.toString() || ''}
                    onChangeText={(value) => {
                      // Only allow single digits 1-10
                      if (value === '' || (value.length === 1 && /^[1-9]$/.test(value)) || (value.length === 2 && value === '10')) {
                        updateAction(action.id, 'mental_score', value);
                      }
                    }}
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={2}
                    textAlign="center"
                    onBlur={() => handleSaveTrainingScores(action)}
                  />
                </View>
                <View style={styles.trainingInputContainer}>
                  <Text style={styles.trainingInputLabel}>Overall</Text>
                  <TextInput
                    style={styles.trainingInputCircle}
                    placeholder=""
                    value={action.overall_score?.toString() || ''}
                    onChangeText={(value) => {
                      // Only allow single digits 1-10
                      if (value === '' || (value.length === 1 && /^[1-9]$/.test(value)) || (value.length === 2 && value === '10')) {
                        updateAction(action.id, 'overall_score', value);
                      }
                    }}
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={2}
                    textAlign="center"
                    onBlur={() => handleSaveTrainingScores(action)}
                  />
                </View>
              </View>
            ) : (
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
                  onFocus={() => {
                    updateValidTimestamps(action.id);
                  }}
                  onBlur={async () => {
                    if (typingPlayer !== null && typingPlayer !== '') {
                      addNewPlayer(typingPlayer);
                      setTypingPlayer(null);
                    }
                    // Parse time mentions and update backend
                    const timeMentionsArray = parseTimeMentions(action.description);
                    console.log(timeMentionsArray);
                    try {
                      console.log(timeMentionsArray);
                      const { error } = await supabase
                        .from('Actions')
                        .update({ time_mentions: timeMentionsArray })
                        .eq('id', action.dbId);
                      if (error) {
                        console.error('Error updating time mentions:', error);
                      }
                    } catch (error) {
                      console.error('Error updating time mentions:', error);
                    }
                    handleSubmitAction(action, false);
                  }}
                  // onSelectionChange={() => {
                  //   if (typingPlayer !== null && typingPlayer !== '') {
                  //     addNewPlayer(typingPlayer);
                  //     setTypingPlayer(null);
                  //   }
                  // }}
                />
                <View style={styles.buttonColumn}>
                  <TouchableOpacity 
                    style={[
                      styles.sketchButton,
                      sketchesWithPaths.has(action.sketch_id) && styles.sketchButtonWithPaths
                    ]}
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
                    source={require('../../../assets/images/pinkTrash.png')}
                    style={styles.deleteButtonIcon}
                  />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      
      {/* </KeyboardAwareScrollView> */}
      
      
      <View style={styles.bottomButtonsContainer}>       
        <TouchableOpacity style={styles.addButton} onPress={handleAddAction}>
          <Text style={styles.plusSign}>+</Text>
        </TouchableOpacity>
      </View>
      {/* Timestamp Modal */}
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
      {/* Timestamp Modal */}
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
    alignItems: 'center',
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
    paddingVertical: 8,
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
    backgroundColor: '#000',
    borderColor: '#F41A99',
    borderWidth: 1,
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
  sketchButtonWithPaths: {
    backgroundColor: '#F41A99',
  },
  sketchButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderColor: '#F41A99',
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
    borderColor: '#F41A99',
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
    color: '#F41A99',
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
  keyboardAvoidingView: {
    flex: 1,
  },
  noteScrollView: {
    flex: 1,
  },
  noteScrollContent: {
    padding: 20,
    paddingBottom: 100,
    alignItems: 'center',
  },
  noteContainer: {
    display: "flex",
    alignItems: "center",
    backgroundColor: 'black',
    height: height,
  },
  noteStyle: {
    width: width*.9,
    minHeight: 100,
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
  trainingInputsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 15,
    marginBottom: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainingInputContainer: {
    alignItems: 'center',
    gap: 8,
  },
  trainingInputLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  trainingInputCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
}); 
