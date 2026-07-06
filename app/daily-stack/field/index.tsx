import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { router, useLocalSearchParams, useRouter } from 'expo-router';
import { OpenAI } from 'openai';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Image, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { ExpandingTextInput } from '../../../components/ExpandingTextInput';
import { KeyboardFormScrollView, KeyboardFormScrollViewRef } from '../../../components/KeyboardFormScrollView';
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

type TrainingLoadMetrics = {
  trimp: number | null;
  aerobic_training_effect: number | null;
  anaerobic_training_effect: number | null;
};
const { width } = Dimensions.get('window');
const MINUTE_OPTIONS = Array.from({ length: 301 }, (_, index) => index);
const SECOND_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);


const client = new OpenAI({
  apiKey: Constants.expoConfig?.extra?.openaiApiKey,
  dangerouslyAllowBrowser: true // Required for Expo/React Native
});

export default function JournalEntryIndex() {
  const { sessionId, sessionDate, sessionType } = useLocalSearchParams();
  const navigation = useNavigation();
  const expoRouter = useRouter();
  const [actions, setActions] = useState<Action[]>([]);
  const [nextId, setNextId] = useState(1);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<KeyboardFormScrollViewRef>(null);
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [pickerActionId, setPickerActionId] = useState<number | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  const [selectedSeconds, setSelectedSeconds] = useState(0);
  const [sketchesWithPaths, setSketchesWithPaths] = useState<Set<string>>(new Set());
  const [playerList, setPlayerList] = useState<Set<string>>(new Set());
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);
  const [validTimestamps, setValidTimestamps] = useState<string[]>([]);
  const [sessionNote, setSessionNote] = useState('');
  const [trainingLoad, setTrainingLoad] = useState<TrainingLoadMetrics | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              expoRouter.replace('/home');
            }
          }}
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}
          hitSlop={8}
          android_ripple={undefined}
        >
          <Ionicons name="chevron-back" size={28} color="#ffffff" />
        </Pressable>
      ),
    });
  }, [navigation, expoRouter]);

  //Pausing playerList functionality at Session level
  // const playerUpdate = async () => {
  //   try {
  //     const { data, error } = await supabase
  //     .from('FieldSessions')
  //     .update({player_mentions: playerList})
  //     .eq('id', sessionId);

  //     console.log(playerList);
  //   } catch (error) {
  //     Alert.alert('Error');
  //   };
  //   };

  // useEffect(() => {
  //   playerUpdate();
  // }, [playerList]);

  // Load existing actions for this session
  const loadExistingActions = async () => {
    if (!sessionId) return;

    try {
      setTrainingLoad(null);
      let sessionData: { physical_score?: number | null; mental_score?: number | null; overall_score?: number | null } | null = null;
      const dateKey = Array.isArray(sessionDate) ? sessionDate[0] : sessionDate;

      navigation.setOptions({ title: 'Field' });

        const fsColumns =
          sessionType === 'training' || sessionType === 'game'
            ? 'physical_score, mental_score, overall_score, note'
            : 'note';

        const { data: fsMeta, error: fsMetaError } = await supabase
          .from('FieldSessions')
          .select(fsColumns)
          .eq('id', sessionId)
          .maybeSingle();

        if (fsMetaError) {
          console.error('Error loading field session:', fsMetaError);
          setSessionNote('');
        } else if (fsMeta) {
          setSessionNote((fsMeta as { note?: string | null }).note ?? '');
          if (sessionType === 'training' || sessionType === 'game') {
            sessionData = {
              physical_score: (fsMeta as { physical_score?: number | null }).physical_score,
              mental_score: (fsMeta as { mental_score?: number | null }).mental_score,
              overall_score: (fsMeta as { overall_score?: number | null }).overall_score,
            };
          }
        } else {
          setSessionNote('');
        }

      if ((sessionType === 'training' || sessionType === 'game') && dateKey) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: tlData, error: tlError } = await supabase
            .from('TrainingLoad')
            .select('trimp, aerobic_training_effect, anaerobic_training_effect')
            .eq('user_id', user.id)
            .eq('date', dateKey)
            .order('date_received', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!tlError && tlData) {
            const hasMetrics =
              tlData.trimp != null ||
              tlData.aerobic_training_effect != null ||
              tlData.anaerobic_training_effect != null;
            if (hasMetrics) {
              setTrainingLoad(tlData);
            }
          }
        }
      }

      // Load field actions
      const { data, error } = await supabase
        .from('FieldActions')
        .select('id, time_stamp_seconds, description, sketch_id')
        .eq('session_id', sessionId)
        .order('time_stamp_seconds', { ascending: true });

      if (error) {
        console.error('Error loading actions:', error);
        return;
      }

      const existingActions: Action[] = [];

      if (sessionType === "training" || sessionType === "game") {
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
        existingActions.push(firstAction);
      }

      const mappedActions: Action[] = (data || []).map((dbAction, index) => ({
        id: -(index + (sessionType === "training" || sessionType === "game" ? 2 : 1)),
        timestamp: timeSwitch(dbAction.time_stamp_seconds),
        description: dbAction.description,
        dbId: dbAction.id,
        sketch_id: dbAction.sketch_id
      }));
      existingActions.push(...mappedActions);

      if (existingActions.length === 0) {
        const starterAction: Action = {
          id: -1,
          timestamp: "",
          description: "",
          dbId: uuidv4(),
          sketch_id: uuidv4(),
        };
        existingActions.push(starterAction);
      }

      setActions(existingActions);
      setNextId(Math.abs(existingActions.length) + 1);
    } catch (error) {
      console.error('Error loading existing actions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExistingActions();
  }, [sessionId, sessionDate, sessionType]);

  // Load player mentions on component mount (ALSO PAUSED LIKE playerUpdate)
  // const loadExistingPlayers = async () => {
  //   try {
  //     const { data, error } = await supabase
  //       .from('FieldSessions')
  //       .select('player_mentions')
  //       .eq('id', sessionId);

  //     if (error) {
  //       console.error('Error loading player mentions:', error);
  //       return;
  //     }

  //     if (data) {
  //       const names = data[0].player_mentions;
  //       setPlayerList(names);
  //     }
  //   } catch (error) {
  //     console.error('Error loading player mentions:', error);
  //   }
  // };

  // useEffect(() => {
  //   loadExistingPlayers();
  // }, []);

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

  // Helper function to add new player to playerMentions table (ALSO PAUSED like playerUpdate)
  const addNewPlayer = async (playerName: string) => {
    if (!playerName || playerName.trim() === '') return;
    setPlayerList(playerList.add(playerName));
    
    // Check if player already exists in playerList
    // if (playerList.add(playerName)) {
    //   return;
    // }
    // // Update playerList state
    // console.log("update should trigger now with: ", playerName);
    // setPlayerList(prev => [...prev, playerName]);
    // console.log(playerList);

  };

  const scrollFieldToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

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
    scrollFieldToBottom();
  };

  const handleSubmitAction = async (action: Action) => {
    if (!sessionId) {
      Alert.alert('Error', 'No session ID found');
      return;
    }
    
    try {

      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: action.description,
        encoding_format: "float",
      });

      if (!response) return;

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
      };

      const { data, error } = await supabase
        .from('FieldActions')
        .upsert([actionData], { onConflict: 'id' })
        .select();

      if (error) {
        console.error('Error submitting action:', error);
        Alert.alert('Error', 'Failed to submit action');
        return;
      }

      action.sketch_id = data[0].sketch_id;
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
            try {
              const { data, error } = await supabase
              .from('FieldActions')
              .delete()
              .eq('id', action.dbId)
              .select();
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
      pathname: '/daily-stack/field/sketchpad/new',
      params: {
        actionId: action.id.toString(), // Use local ID for navigation
        sessionId: sessionId as string,
        sketchId: action.sketch_id.toString()
      }
    });
  };

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
          const timePattern = /^(\d{1,3}:\d{2})$/;
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
        .from('FieldSessions')
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

  const saveFieldSessionNote = async (noteText: string) => {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('FieldSessions')
        .update({ note: noteText || null })
        .eq('id', sessionId);

      if (error) {
        console.error('Error saving session note:', error);
      }
    } catch (error) {
      console.error('Error saving session note:', error);
    }
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
    handleSubmitAction(updatedAction);
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
    <View style={styles.container}>
      <KeyboardFormScrollView
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
      >
        {(sessionType === "training" || sessionType === "game") && actions[0] ? (
          <>
            <View key={actions[0].id} style={styles.actionContainer}>
              <View style={styles.trainingInputsRow}>
                <View style={styles.trainingInputContainer}>
                  <Text style={styles.trainingInputLabel}>Physical</Text>
                  <TextInput
                    style={styles.trainingInputCircle}
                    placeholder=""
                    value={actions[0].physical_score?.toString() || ''}
                    onChangeText={(value) => {
                      if (value === '' || (value.length === 1 && /^[1-9]$/.test(value)) || (value.length === 2 && value === '10')) {
                        updateAction(actions[0].id, 'physical_score', value);
                      }
                    }}
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={2}
                    textAlign="center"
                    onBlur={() => handleSaveTrainingScores(actions[0])}
                  />
                </View>
                <View style={styles.trainingInputContainer}>
                  <Text style={styles.trainingInputLabel}>Mental</Text>
                  <TextInput
                    style={styles.trainingInputCircle}
                    placeholder=""
                    value={actions[0].mental_score?.toString() || ''}
                    onChangeText={(value) => {
                      if (value === '' || (value.length === 1 && /^[1-9]$/.test(value)) || (value.length === 2 && value === '10')) {
                        updateAction(actions[0].id, 'mental_score', value);
                      }
                    }}
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={2}
                    textAlign="center"
                    onBlur={() => handleSaveTrainingScores(actions[0])}
                  />
                </View>
                <View style={styles.trainingInputContainer}>
                  <Text style={styles.trainingInputLabel}>Overall</Text>
                  <TextInput
                    style={styles.trainingInputCircle}
                    placeholder=""
                    value={actions[0].overall_score?.toString() || ''}
                    onChangeText={(value) => {
                      if (value === '' || (value.length === 1 && /^[1-9]$/.test(value)) || (value.length === 2 && value === '10')) {
                        updateAction(actions[0].id, 'overall_score', value);
                      }
                    }}
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={2}
                    textAlign="center"
                    onBlur={() => handleSaveTrainingScores(actions[0])}
                  />
                </View>
              </View>
              {trainingLoad && (
                <View style={styles.trainingInputsRow}>
                  {trainingLoad.trimp != null && (
                    <View style={styles.trainingInputContainer}>
                      <Text style={styles.trainingInputLabel}>TRIMP</Text>
                      <View style={styles.trainingInputCircleDisplay}>
                        <Text style={styles.trainingInputValue}>{trainingLoad.trimp}</Text>
                      </View>
                    </View>
                  )}
                  {trainingLoad.aerobic_training_effect != null && (
                    <View style={styles.trainingInputContainer}>
                      <Text style={styles.trainingInputLabel}>Aerobic</Text>
                      <View style={styles.trainingInputCircleDisplay}>
                        <Text style={styles.trainingInputValue}>{trainingLoad.aerobic_training_effect}</Text>
                      </View>
                    </View>
                  )}
                  {trainingLoad.anaerobic_training_effect != null && (
                    <View style={styles.trainingInputContainer}>
                      <Text style={styles.trainingInputLabel}>Anaerobic</Text>
                      <View style={styles.trainingInputCircleDisplay}>
                        <Text style={styles.trainingInputValue}>{trainingLoad.anaerobic_training_effect}</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
            <ExpandingTextInput
              containerStyle={styles.noteInputContainer}
              inputStyle={styles.noteInput}
              placeholder="Add a note..."
              placeholderTextColor="#999"
              value={sessionNote}
              onChangeText={setSessionNote}
              onBlur={() => saveFieldSessionNote(sessionNote)}
            />
            {actions.slice(1).map((action) => (
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
                  <ExpandingTextInput
                    containerStyle={styles.descriptionInputContainer}
                    inputStyle={styles.descriptionInput}
                    placeholder="Description of action..."
                    value={action.description}
                    onChangeText={(value) => updateAction(action.id, 'description', value)}
                    placeholderTextColor="#999"
                    onFocus={() => {
                      updateValidTimestamps(action.id);
                    }}
                    onBlur={async () => {
                      if (typingPlayer !== null && typingPlayer !== '') {
                        addNewPlayer(typingPlayer);
                        setTypingPlayer(null);
                      }
                      const timeMentionsArray = parseTimeMentions(action.description);
                      try {
                        const { error } = await supabase
                          .from('FieldActions')
                          .update({ time_mentions: timeMentionsArray })
                          .eq('id', action.dbId);
                        if (error) {
                          console.error('Error updating time mentions:', error);
                        }
                      } catch (error) {
                        console.error('Error updating time mentions:', error);
                      }
                      handleSubmitAction(action);
                    }}
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
              </View>
            ))}
          </>
        ) : (
          <>
            {sessionType === "other" && (
              <ExpandingTextInput
                containerStyle={styles.noteInputContainer}
                inputStyle={styles.noteInput}
                placeholder="Add a note..."
                placeholderTextColor="#999"
                value={sessionNote}
                onChangeText={setSessionNote}
                onBlur={() => saveFieldSessionNote(sessionNote)}
              />
            )}
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
                  <ExpandingTextInput
                    containerStyle={styles.descriptionInputContainer}
                    inputStyle={styles.descriptionInput}
                    placeholder="Description of action..."
                    value={action.description}
                    onChangeText={(value) => updateAction(action.id, 'description', value)}
                    placeholderTextColor="#999"
                    onFocus={() => {
                      updateValidTimestamps(action.id);
                    }}
                    onBlur={async () => {
                      if (typingPlayer !== null && typingPlayer !== '') {
                        addNewPlayer(typingPlayer);
                        setTypingPlayer(null);
                      }
                      const timeMentionsArray = parseTimeMentions(action.description);
                      try {
                        const { error } = await supabase
                          .from('FieldActions')
                          .update({ time_mentions: timeMentionsArray })
                          .eq('id', action.dbId);
                        if (error) {
                          console.error('Error updating time mentions:', error);
                        }
                      } catch (error) {
                        console.error('Error updating time mentions:', error);
                      }
                      handleSubmitAction(action);
                    }}
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
              </View>
            ))}
          </>
        )}
      </KeyboardFormScrollView>
      
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
    alignItems: 'flex-start',
  },
  timestampInput: {
    width: 72,
    flexShrink: 0,
    height: 40,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: '#1a1a1a',
    fontSize: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timestampText: {
    color: '#e5e5e5',
    fontSize: 16,
  },
  timestampPlaceholder: {
    color: '#999',
  },
  descriptionInputContainer: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    color: '#e5e5e5',
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 40,
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
  noteInputContainer: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  noteInput: {
    width: '100%',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    color: '#e5e5e5',
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
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
    color: '#e5e5e5',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  trainingInputCircleDisplay: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainingInputValue: {
    color: '#e5e5e5',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
