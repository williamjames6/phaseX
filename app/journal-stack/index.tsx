import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import { File, Paths } from 'expo-file-system';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { convertToCSV } from "../../assets/helpers/json2SCV";
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';
import { supabase } from '../../lib/supabase';

interface Session {
  id: number;
  date: string;
  type: string;
  description: string | null;
}
const MAX_DOWNLOAD_INT = 10000000;

export default function JournalIndex() {
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedType, setSelectedType] = useState('training');
  const [sessionDescription, setSessionDescription] = useState('');
  const limit = 10;
  const navigation = useNavigation();
  const today = new Date();
  const monthAgo = new Date();
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(today.getFullYear() - 2);
  monthAgo.setMonth(today.getMonth()- 1);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useHeaderWithMenu({
    title: 'Journal',
    onMenuPress: () => setIsSidebarVisible(true),
    headerRight: () => (
      <TouchableOpacity onPress={() => setShowDownloadModal(true)}>
        <Image
          source={require('../../assets/images/download.png')}
          style={{height: 25, width: 25, tintColor: 'white'}}
        />
      </TouchableOpacity>
    ),
  });

  const downloadMonthlyActions = async (start: Date | null, end: Date | null) => {

    const now = new Date();
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
    const firstDay = start.toISOString();
    const lastDay = end.toISOString();
    console.log(firstDay, lastDay);
    // const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    const { data, error } = await supabase //don't like this format without "try, catch" blocks but just trying to get functionality right now
      .from('Actions')
      .select('time_stamp, description, session_date')
      .gte('session_date', firstDay)
      .lte('session_date', lastDay)
      .order("session_date", {ascending: true});
  
    if (error || !data) {
      console.log(error);
      Alert.alert("Failure to retrieve requested actions. What are you gonna do, cry about it? Fuck you.");
      return;
    }
    const csv = convertToCSV(data);

    //let monthName = now.toLocaleString('default', { month: 'long' }), year= now.toLocaleDateString('default', {year: 'numeric'});
    let random = Math.floor(Math.random() * MAX_DOWNLOAD_INT).toString();
    console.log(random);
    const fileName = `${random}_actions.csv`; 
    try { 
      const file = new File(Paths.cache, fileName);
      file.create(); // can throw an error if the file already exists or no permission to create it
      file.write(csv);
      console.log(file.textSync)
    } catch (error) {
      console.log("what the heck: ", error);
      return;
    }
    console.log("File: ", File, typeof(File));
    console.log("Paths: ", Paths.cache, typeof(Paths));
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
  }
  

  const loadRecentSessions = async (isLoadMore = false) => {
    try {
      const currentOffset = isLoadMore ? offset : 0;
      
      const { data, error } = await supabase
        .from('Sessions')
        .select('id, date, type, description')
        .order('date', { ascending: false })
        .range(currentOffset, currentOffset + limit - 1);

      if (error) {
        console.error('Error fetching sessions:', error);
        return;
      }

      if (isLoadMore) {
        setRecentSessions(prev => [...prev, ...(data || [])]);
        setOffset(currentOffset + limit);
      } else {
        setRecentSessions(data || []);
        setOffset(limit);
      }

      // Check if there are more sessions to load
      setHasMore((data || []).length === limit);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreSessions = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    await loadRecentSessions(true);
  };

  // Refresh sessions when user returns to this page (e.g., after deleting a session)
  useFocusEffect(
    useCallback(() => {
      loadRecentSessions();
    }, [])
  );

  const handleNewSession = async () => {
    setShowModal(true);
  };

  const handleCreateSession = async () => {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(selectedDate)) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('Sessions')
        .insert([
          {
            date: selectedDate,
            type: selectedType,
            description: sessionDescription,
          }
        ])
        .select();

      if (error) {
        console.error('Error creating session:', error);
        Alert.alert('Error', 'Failed to create new session');
        return;
      }

      // Navigate to journal entry with the new session ID
      if (data && data[0]) {
        router.push(`/journal-stack/journalEntry?sessionId=${data[0].id}&sessionDate=${selectedDate}&sessionType=${selectedType}`);
      }
      
      // Reset modal state and reload sessions
      setShowModal(false);
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setSelectedType('training');
      setSessionDescription('');
      loadRecentSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create new session');
    }
  };

  const handleSessionPress = async (session: Session) => {
    try {
      // Navigate to journal entry with the existing session ID
      router.push(`/journal-stack/journalEntry?sessionId=${session.id}&sessionDate=${session.date}&sessionType=${session.type}`);
    } catch (error) {
      console.error('Error navigating to session:', error);
      Alert.alert('Error', 'Failed to open session');
    }
  };

  const formatDate = (dateString: string) => {
    // Parse the date string manually to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    return date.toLocaleDateString('en-US', { 
      //weekday: 'long', 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric' 
    });
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!sessionId) {
      Alert.alert('Error', 'No session ID found');
      return;
    }

    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This will permanently remove the session, all its actions, and any associated sketches.',
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
              // First, get all actions for this session to find their IDs
              const { data: actions, error: fetchActionsError } = await supabase
                .from('Actions')
                .select('sketch_id')
                .eq('session_id', sessionId);

              if (fetchActionsError) {
                console.error('Error fetching actions:', fetchActionsError);
                Alert.alert('Error', 'Failed to fetch actions');
                return;
              }

              if (actions && actions.length > 0) {
                const sketchIds = actions.map(action => action.sketch_id);

                // Delete tactical sketches that reference these actions
                const { error: sketchesError } = await supabase
                  .from('TacticalSketches')
                  .delete()
                  .in('id', sketchIds);

                if (sketchesError) {
                  console.error('Error deleting sketches:', sketchesError);
                  Alert.alert('Error', 'Failed to delete sketches');
                  return;
                }

                // Then delete all actions for this session
                const { error: actionsError } = await supabase
                  .from('Actions')
                  .delete()
                  .eq('session_id', sessionId);

                if (actionsError) {
                  console.error('Error deleting actions:', actionsError);
                  Alert.alert('Error', 'Failed to delete actions');
                  return;
                }
              }

              // Finally delete the session
              const { error: sessionError } = await supabase
                .from('Sessions')
                .delete()
                .eq('id', sessionId);

              if (sessionError) {
                console.error('Error deleting session:', sessionError);
                Alert.alert('Error', 'Failed to delete session');
                return;
              }

              console.log('Session, actions, and sketches deleted successfully');
              Alert.alert('Success', 'Session deleted successfully');
              
              // Refresh the sessions list
              loadRecentSessions();
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

      <View style={styles.addContainer}>           
        <TouchableOpacity style={styles.addButton} onPress={handleNewSession}>
          <Text style={styles.plusSign}>+</Text>
        </TouchableOpacity>
      </View>
    
      {loading ? (
        <Text style={styles.loadingText}>Loading sessions...</Text>
      ) : recentSessions.length > 0 ? (
        <View style={styles.sessionsContainer}>
          {recentSessions.map((session) => (
            <TouchableOpacity 
              key={session.id} 
              style={styles.sessionButton}
              onPress={() => handleSessionPress(session)}
              onLongPress={() => handleDeleteSession(session.id)}
            >
              {
                session.description !== null ? (
                  <View>
                    <Text style={styles.sessionButtonText}>
                      {formatDate(session.date)} - {session.type.charAt(0).toUpperCase() + session.type.slice(1)}
                    </Text>
                    <Text style={styles.loadingText}>
                      {session.description}
                    </Text>
                  </View>
                ) : (
                <Text style={styles.sessionButtonText}>
                  {formatDate(session.date)} - {session.type.charAt(0).toUpperCase() + session.type.slice(1)}
                </Text>
                )
              }
            </TouchableOpacity>
          ))}
          
          {hasMore && (
            <TouchableOpacity 
              style={styles.loadMoreButton}
              onPress={loadMoreSessions}
              disabled={loadingMore}
            >
              <Text style={styles.loadMoreButtonText}>
                {loadingMore ? 'Loading...' : 'Load More'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Text style={styles.noSessionsText}>No sessions yet. Create your first one!</Text>
      )}
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
              <Text style={styles.modalTitle}>Action Download</Text>
              
              {/* Date Range input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Date Range:</Text>

                {/* Start Date */}
                {/* <Button
                  title={startDate ? startDate.toDateString() : "Select Start Date"}
                  onPress={() => setShowStartPicker(!showStartPicker)}
                /> */}
                {/* {showStartPicker && ( */}
                <View style={styles.datePicker}>
                  <DateTimePicker
                    //style={{backgroundColor: 'rgba(0,0,0,0.5)', width: '80%'}}
                    value={startDate || monthAgo}
                    mode="date"
                    //display={Platform.OS === "ios" ? "inline" : "default"}
                    display={Platform.OS === 'ios' ? 'default' : 'calendar'}
                    minimumDate={twoYearsAgo}
                    maximumDate={today}
                    onChange={(event, date) => {
                      //setShowStartPicker(false);
                      if (date) setStartDate(date);
                    }}
                  />
                </View>
                {/* )} */}

                {/* End Date */}
                {/* <Button
                  title={endDate ? endDate.toDateString() : "Select End Date"}
                  onPress={() => setShowEndPicker(!showEndPicker)}
                /> */}
                {/* {showEndPicker && ( */}
                <View style={styles.datePicker}>
                  <DateTimePicker
                    value={endDate || today}
                    mode="date"
                    display={Platform.OS === "ios" ? "default" : "calendar"}
                    minimumDate={twoYearsAgo}
                    maximumDate={today}
                    onChange={(event, date) => {
                      setShowEndPicker(false);
                      if (date) setEndDate(date);
                    }}
                  />
                </View>
                 {/* )} */}
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
      {/* New Session Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Session</Text>
              
              {/* Date Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Date:</Text>
                <TextInput
                  style={styles.dateInput}
                  value={selectedDate}
                  onChangeText={setSelectedDate}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              
              {/* Type Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Type:</Text>
                <View style={styles.typeContainer}>
                  {['training', 'game', 'note', 'other'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        selectedType === type && styles.typeButtonSelected
                      ]}
                      onPress={() => setSelectedType(type)}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        selectedType === type && styles.typeButtonTextSelected
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description (optional):</Text>
                <TextInput
                  style={styles.sessionDescription}
                  value={sessionDescription}
                  onChangeText={setSessionDescription}
                  placeholder="e.g. UCL Bayern vs. PSG"
                  keyboardType="default"
                />
              </View>
              
              {/* Action Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowModal(false);
                    setSelectedDate(new Date().toISOString().split('T')[0]);
                    setSelectedType('training');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleCreateSession}
                >
                  <Text style={styles.createButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      </ScrollView>
      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />
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
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  primaryButton: {
    backgroundColor: '#ff9800',
    padding: 22.5,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sessionsContainer: {
    marginBottom: 30,
  },
  sessionButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sessionButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#f57c00',
    padding: 22.5,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  secondaryButton: {
    backgroundColor: '#f57c00',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    //marginBottom: 30,
  },
  noSessionsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  loadMoreButton: {
    backgroundColor: '#ff9800',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  loadMoreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
  inputContainer: {
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
  dateInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#333',
  },
  typeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  typeButton: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  typeButtonSelected: {
    backgroundColor: '#ff9800',
    borderColor: '#ff9800',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  typeButtonTextSelected: {
    color: 'white',
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
    backgroundColor: '#ff9800',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  plusSign: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  addButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F41A99',
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
    marginBottom: 20,
  },
  addContainer: {
    flexDirection: "row",
    width: "100%",
    alignItems: 'center',
    justifyContent: "center",
  },
  sessionDescription: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  }
}); 