import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { dateFormatter } from "../../assets/helpers/dateFormatter";
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';
import { supabase } from '../../lib/supabase';

interface Session {
  id: number;
  date: string;
  type: string;
  description: string | null;
}

export default function JournalIndex() {
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedType, setSelectedType] = useState('training');
  const [sessionDescription, setSessionDescription] = useState('');
  const limit = 20;
  const today = new Date();
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(today.getFullYear() - 2);

  useEffect(() => {
    console.log("Mounted: journal stack index page");
    return () => console.log("Unmounted: journal stack index page");
  }, []);

  // Memoize the onMenuPress callback
  const handleMenuPress = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  useHeaderWithMenu({
    title: 'Journal',
    onMenuPress: handleMenuPress,
  });
  

  // Memoize loadRecentSessions to prevent unnecessary re-creations
  const loadRecentSessions = useCallback(async (isLoadMore = false) => {
    try {
      const currentOffset = isLoadMore ? offsetRef.current : 0;
      console.log("Current offset: ", currentOffset);
      
      // First, get the Master session (NULL date) separately
      const { data: masterSession, error: masterError } = await supabase
        .from('FieldSessions')
        .select('id, date, type, description')
        .is('date', null)
        .single();

      if (masterError && masterError.code !== 'PGRST116') {
        console.error('Error fetching master session:', masterError);
      }

      // Then get regular sessions
      const { data, error } = await supabase
        .from('FieldSessions')
        .select('id, date, type, description')
        .not('date', 'is', null)
        .order('date', { ascending: false })
        .range(currentOffset, currentOffset + limit - 1);

      if (error) {
        console.error('Error fetching sessions:', error);
        return;
      }

      // Combine master session (if exists) with regular sessions
      const allSessions = [];
      if (masterSession && !isLoadMore) {
        allSessions.push(masterSession);
      }
      if (data) {
        allSessions.push(...data);
      }

      if (isLoadMore) {
        setRecentSessions(prev => {
          console.log("Previous length:", prev.length);
          console.log("New data length:", (data || []).length);
          console.log("New total length:", [...prev, ...(data || [])].length);
          return [...prev, ...(data || [])]
        })
        // setRecentSessions(prev => {
        //   // Remove master session from prev if it exists, then add all new sessions
        //   const prevWithoutMaster = prev.filter(session => session.date !== null);
        //   console.log("setting recent session: ", [...prevWithoutMaster, ...(data || [])].length);
        //   return [...prevWithoutMaster, ...(data || [])];
        // });
        console.log("Old recent session length: ", recentSessions.length);
        offsetRef.current = currentOffset + limit;
      } else {
        setRecentSessions(allSessions);
        offsetRef.current = limit;
      }

      // Check if there are more sessions to load
      setHasMore((data || []).length === limit);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit]);

  const loadMoreSessions = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    await loadRecentSessions(true);
  };

  // Refresh sessions when user returns to this page (e.g., after deleting a session)
  useFocusEffect(
    useCallback(() => {
      loadRecentSessions();
    }, [loadRecentSessions])
  );

  const handleNewSession = async () => {
    setShowModal(true);
  };

  const handleCreateSession = async () => {
    const dateString = dateFormatter(selectedDate);

    try {
      const { data, error } = await supabase
        .from('FieldSessions')
        .insert([
          {
            date: dateString,
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
        router.push(`/journal-stack/journalEntry?sessionId=${data[0].id}&sessionDate=${dateString}&sessionType=${selectedType}`);
      }
      
      // Reset modal state and reload sessions
      setShowModal(false);
      setSelectedDate(new Date());
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
          text: 'Modify',
          style: 'default',
          onPress: async () => {
            setShowModal(true)
            return;
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // First, get all actions for this session to find their IDs
              const { data: actions, error: fetchActionsError } = await supabase
                .from('FieldActions')
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
                  .from('FieldActions')
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
                .from('FieldSessions')
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
              style={[styles.sessionButton, session.date === null && styles.masterSessionButton]}
              onPress={() => handleSessionPress(session)}
              onLongPress={() => handleDeleteSession(session.id)}
            >
                   <View style={styles.sessionButtonView}>
                    {session.date === null ? 
                      (<Text style={styles.masterButtonText}>
                        MASTER
                      </Text>) :
                      <View style={styles.sessionButtonView}>
                        <Text style={styles.sessionButtonText}>
                          {`${session.date}`}
                        </Text>
                        <Text style={styles.sessionSubtitle}>
                          {session.description ? session.description : `${session.type.charAt(0).toUpperCase() + session.type.slice(1)}`}
                        </Text>
                      </View>                 
                    }
                  </View>
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
              
              {/* Date Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Date:</Text>
                <View style={styles.datePicker}>
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'default' : 'calendar'}
                    minimumDate={twoYearsAgo}
                    maximumDate={today}
                    onChange={(event, date) => {
                      if (date) setSelectedDate(date);
                    }}
                  />
                </View>
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
                    setSelectedDate(new Date());
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
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  masterSessionButton: {
    backgroundColor: '#1a1a1a',
    borderColor: '#F41A99',
    borderWidth: 2,
  },
  sessionButtonText: {
    color: '#e5e5e5',
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
  },
  noSessionsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  loadMoreButton: {
    backgroundColor: '#F41A99',
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
  },
  sessionButtonView: {
    flex: 1,
    alignItems: 'center',
  },
  masterButtonText: {
    fontWeight: '800',
    color: '#e5e5e5'
  },
  sessionSubtitle: {
    fontStyle: "italic",
    fontSize: 16,
    color: '#666',
  }
}); 