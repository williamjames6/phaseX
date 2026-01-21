import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { OpenAI } from 'openai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import useAppState from 'react-native-useappstate';
import { dateFormatter } from '../../assets/helpers/dateFormatter';
import { convertToCSV } from '../../assets/helpers/json2SCV';
import { timeSwitch } from '../../assets/helpers/timeSwitch';
import { chainRunner } from '../../chainRunner';
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';
import { supabase } from '../../lib/supabase';


const { width } = Dimensions.get('window');
const MAX_DOWNLOAD_INT = 10000000;
const client = new OpenAI({
  apiKey: Constants.expoConfig?.extra?.openaiApiKey,
  dangerouslyAllowBrowser: true // Required for Expo/React Native
});


export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const today = new Date();
  const monthAgo = new Date();
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(today.getFullYear() - 2);
  monthAgo.setMonth(today.getMonth() - 1);
  const [startDate, setStartDate] = useState<Date | null>(monthAgo);
  const [endDate, setEndDate] = useState<Date | null>(today);
  const appState = useAppState();
  const rotationValue = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<number | null>(null);


  //sleep modal for first login of the day
  useEffect(() => {
    sleepCheck();
  }, []);

  //auto log out if screen in background for 10 minutes or more
  useEffect(() => {
      if (appState === 'background') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        };
        timeoutRef.current = setTimeout(() => {
          router.replace('/');
          console.log('timed out');
          return;
        }, 600000);


      } else if (appState === 'active') {
        // Clear timeout when app becomes active
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
  }, [appState]);

  // Rotation animation effect
  useEffect(() => {
    const startRotation = () => {
      rotationValue.setValue(0);
      Animated.loop(
        Animated.timing(rotationValue, {
          toValue: 1,
          duration: 30000, // 30 seconds for 2 RPM (2 rotations per minute)
          useNativeDriver: true,
        })
      ).start();
    };

    if (chatHistory.length === 0) {
      startRotation();
    } else {
      rotationValue.stopAnimation();
    }
  }, [chatHistory.length, rotationValue]);

  //Check if first login of the day for user. If so, prompt them to fill in sleep data.
  //If not, return;
  const sleepCheck = async () => {
    const currentTime = new Date();
    try {
      // Get authenticated user's ID instead of relying on URL params
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user, skipping sleep check');
        return;
      }
      
      const authenticatedUserId = user.id;
      
      const {data, error} = await supabase
        .from("UserMetadata")
        .upsert(
          [
            { user_id: authenticatedUserId }
          ],                 
          { onConflict: "user_id" }        
        )
        .select("*")
        .single()
      if (error) throw error;
      
      if (data?.previous_sign_in) {
        if (new Date(data.previous_sign_in).getDate() == currentTime.getDate()) {
          return;
        };
      };
      
      //Add night entry to Sleep table in backend
      const {data: night, error: error2} = await supabase
      .from("Sleep")
      .insert({
        date: dateFormatter(currentTime),
        user_id: authenticatedUserId
      })
      
      if (error2) throw error2;
        
      //Update previous_sign_in value for currently signed in user
      const {data: finalData, error: finalError} = await supabase
        .from("UserMetadata")
        .upsert(
          [
            {
              user_id: authenticatedUserId,
              previous_sign_in: currentTime
            }
          ],
          { onConflict: "user_id" }
        );
      if (finalError) throw finalError;
      setShowSleepModal(true);
    } catch (error) {
      console.error('Error in sleepCheck:', error);
      // Don't throw - just log the error to prevent breaking the app
    }
    
    return;
  }

  //make request to openAI API
  const handleSearch = async () => {
    Keyboard.dismiss();

    try {

      // Add user's query to chat history
      setChatHistory(prev => [...prev, `You: ${query}`]);
      setQuery(''); // Clear the input after sending
      // Get the current user

      // console.log("SUPABASE: \n\n\n", supabase);
      // console.log("OPENAI: \n\n\n", client);
      const { assistantText } = await chainRunner(
        query,
        supabase,
        client
      );


      // Add assistant's response to chat history
      setChatHistory(prev => [...prev, `Assistant: ${assistantText}`]);
      setResponse(assistantText);

    } catch (error) {
      console.error("Query failed: ", error);
      setChatHistory(prev => [...prev, `Error: ${error}`]);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  // Memoize the headerRight function to prevent unnecessary re-renders
  const headerRight = useMemo(() => () => (
    <TouchableOpacity 
      onPress={() => setShowDownloadModal(true)}
      style={{ 
        padding: 8, 
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Image
        source={require('../../assets/images/download.png')}
        style={{height: 25, width: 25, tintColor: 'white'}}
      />
    </TouchableOpacity>
  ), []);

  const downloadMonthlyActions = async (start: Date | null, end: Date | null) => {
    if (!start || !end) {
      Alert.alert("Please enter a valid date range");
      return;
    }
    if (start > end) {
      let temp = start;
      start = end;
      end = temp;
    }
    console.log("Start:  ", start, "End:  ", end);
    const firstDay = dateFormatter(start) //+ 'T00:00:00.000Z';
    const lastDay = dateFormatter(end) //+ 'T23:59:59.999Z';
    try {
      console.log(firstDay, lastDay);

      //specific action
      const { data: actionData, error: actionError } = await supabase 
      .from('FieldActions')
      .select('session_date, time_stamp_seconds, description, player_mentions, time_mentions, self')
      .gte('session_date', firstDay)
      .lte('session_date', lastDay)
      .order("session_date", {ascending: true});

      if (actionError) {console.log(actionError)};
      
      //gym data
      const { data: gymData, error: gymError } = await supabase 
      .from('GymSessions')
      .select('session_date, data, note')
      .gte('session_date', firstDay)
      .lte('session_date', lastDay)
      .order("session_date", {ascending: true});

      if (gymError) {console.log(gymError)};
      //field session data
      const { data: fieldData, error: fieldError } = await supabase
      .from('FieldSessions')
      .select('date, type, description, physical_score, mental_score, overall_score, player_mentions')
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order("date", {ascending: true});

      if (fieldError) {console.log(fieldError)};

      //##########################################################################################
      
      // Default to empty arrays if data is null/undefined to allow partial downloads
      const safeGymData = gymData || [];
      const safeFieldData = fieldData || [];
      const safeActionData = actionData || [];

      
      let processedData: any[] = [];
      let iterator = new Date(start);
      const endDate = new Date(end);
      let actionIndex = 0;
      let fieldIndex = 0;
      let gymIndex = 0;
      
      while (iterator <= endDate) {
        let dateObject = {
          date: dateFormatter(iterator),
          gym_data: [] as any[],
          session_data: [] as any[],
        };
        
        // Check bounds before accessing gymData
        while (gymIndex < safeGymData.length && safeGymData[gymIndex]?.session_date == dateFormatter(iterator)) {
          dateObject.gym_data.push(safeGymData[gymIndex].data);
          gymIndex++;
        }

        // Check bounds before accessing fieldData
        while (fieldIndex < safeFieldData.length && safeFieldData[fieldIndex]?.date == dateFormatter(iterator)) {
          let { date, ...sessionWithoutDate} = safeFieldData[fieldIndex];
          let relevantActions = [];
          
          // Check bounds before accessing actionData
          while (actionIndex < safeActionData.length && safeActionData[actionIndex]?.session_date == safeFieldData[fieldIndex].date) {
            let { session_date, ...actionWithoutDate} = safeActionData[actionIndex];
            let { time_stamp_seconds, ...actionWithoutTime} = actionWithoutDate;
            let actionWithTimestamp = {...actionWithoutTime, time_stamp: timeSwitch(safeActionData[actionIndex].time_stamp_seconds)}
            relevantActions.push(actionWithTimestamp);
            actionIndex++
          };
          
          let final = {...sessionWithoutDate, actions: relevantActions};
          dateObject.session_data.push(final);
          fieldIndex++     
        }
        
        processedData.push(dateObject);

        // Safely increment date
        iterator.setDate(iterator.getDate() + 1);
      };
      


      const csv = convertToCSV(processedData);

      let random = Math.floor(Math.random() * MAX_DOWNLOAD_INT).toString();
      const fileName = `${random}_actions.csv`; 
      try { 
        const file = new File(Paths.cache, fileName);
        file.create(); // can throw an error if the file already exists or no permission to create it
        file.write(csv);
      } catch (error) {
        console.log("what the heck: ", error);
        return;
      }

      // after fileUri is written
      const fileUri = Paths.cache.uri + fileName;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
        setShowDownloadModal(false);
        setStartDate(null);
        setEndDate(null);
      } else {
        console.warn("Sharing not available");
      };

    } catch (actionError: any) {
      Alert.alert("Failure to retrieve requested actions. What are you gonna do, cry about it? Fuck you.", actionError);
      return;
    };
  }

  useHeaderWithMenu({
    title: 'phaseX',
    onMenuPress: toggleSidebar,
    headerRight: headerRight,
  });

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        {/* Main Content */}
        <View style={[styles.moduleContainer, { backgroundColor: "black" }]}>
          <View style={styles.searchContainer}>
            <ScrollView 
              style={styles.chatContainer}
              contentContainerStyle={styles.chatContentContainer}
              keyboardShouldPersistTaps="handled"
            >
              {chatHistory.length === 0 ? (
                <View style={styles.animationContainer}>
                  <Animated.View
                    style={[
                      styles.rotatingLogo,
                      {
                        transform: [
                          {
                            rotateY: rotationValue.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Image
                      source={require('../../assets/images/onwards.png')}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </View>
              ) : (
                chatHistory.map((message, index) => (
                  <Text key={index} style={styles.chatMessage}>{message}</Text>
                ))
              )}
            </ScrollView>
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="How do you want to get better today?"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                multiline={true}
                scrollEnabled={false}
                style={styles.textInput}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity
                onPress={handleSearch}
                activeOpacity={0.8}
                style={styles.sendButton}
              >
                <Ionicons name="arrow-up" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Download Sessions Modal */}
      <Modal
        visible={showDownloadModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDownloadModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Data Download</Text>
              
              {/* Date Range input */}
              <View style={styles.modalInputContainer}>
                <Text style={styles.inputLabel}>Date Range:</Text>

                <View style={styles.datePicker}>
                  <DateTimePicker
                    value={startDate || monthAgo}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'default' : 'calendar'}
                    minimumDate={twoYearsAgo}
                    maximumDate={today}
                    onChange={(event, date) => {
                      //setShowStartPicker(false);
                      if (date) setStartDate(date);
                    }}
                  />
              </View>
                <View style={styles.datePicker}>
                  <DateTimePicker
                    value={endDate || today}
                    mode="date"
                    display={Platform.OS === "ios" ? "default" : "calendar"}
                    minimumDate={twoYearsAgo}
                    maximumDate={today}
                    onChange={(event, date) => {
                      //setShowEndPicker(false);
                      if (date) setEndDate(date);
                    }}
                  />
                </View>
              </View>
              
              {/* Action Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setStartDate(null);
                    setEndDate(null);
                    setShowDownloadModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={() => downloadMonthlyActions(startDate, endDate)}
                >
                  <Text style={styles.createButtonText}>Download</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Sleep Modal */}
      <Modal
        visible={showSleepModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSleepModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Fill in Sleep Data</Text>
              <Text style={styles.modalText}>Would you like to fill in your sleep data for the previous night?</Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowSleepModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={() => {
                    const currentTime = new Date();
                    router.push(`/physical-stack/sleep/entry?date=${dateFormatter(currentTime)}`);
                    setShowSleepModal(false);
                  }}
                >
                  <Text style={styles.createButtonText}>Go to sleep</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />
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
  moduleContainer: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  moduleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  searchContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 5,
  },
  chatContainer: {
    flex: 1,
    width: '100%',
    marginBottom: 5,
    borderRadius: 8,
  },
  chatContentContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  animationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotatingLogo: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  chatMessage: {
    fontSize: 16,
    marginBottom: 5,
    padding: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
  },
  inputContainer: {
    width: width*.9,
    marginHorizontal: 0,
    paddingRight: 0,
    paddingLeft: 0,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 24,
    backgroundColor: 'white',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  textInput: {
    width: '100%',
    paddingHorizontal: 8,
    fontSize: 16,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    alignSelf: 'flex-end',
    marginRight: 5,
    marginTop: 5,
    marginBottom: 5
    //marginLeft: 'auto',
    //alignSelf: 'flex-end',
    // paddingRight: 5,
    // paddingBottom: 5,
  },
  sidebarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  sidebarButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
    textAlign: 'center',
  },
  modalInputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#555',
  },
  datePicker: {
    margin: 6,
    alignSelf: 'center'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#000',
  },
  createButtonText: {
    color: 'yellow',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 