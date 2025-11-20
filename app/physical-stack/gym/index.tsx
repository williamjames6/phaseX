import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { dateFormatter } from "../../../assets/helpers/dateFormatter";
import { supabase } from '../../../lib/supabase';

interface GymSession {
  id: string;
  session_date: string;
  data: any; // JSONB data for storing superset information
}

export default function GymIndex() {
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const loadSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to view gym sessions');
        return;
      }

      const { data, error } = await supabase
        .from('GymSessions')
        .select('*')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load gym sessions');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

  const handleNewSession = () => {
    setSelectedDate(new Date());
    setShowModal(true);
  };

  const handleCreateSession = () => {
    const dateString = dateFormatter(selectedDate)
    setShowModal(false);
    router.push(`/physical-stack/gym/session?sessionDate=${dateString}`);
  };

  const handleSessionPress = (session: GymSession) => {
    router.push(`/physical-stack/gym/session?id=${session.id}`);
  };

  const handleSessionLongPress = (session: GymSession) => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete the gym session from ${session.session_date}? This will permanently remove all exercises and data in this session.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSession(session),
        },
      ]
    );
  };

  const deleteSession = async (session: GymSession) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to delete sessions');
        return;
      }

      const { error } = await supabase
        .from('GymSessions')
        .delete()
        .eq('id', session.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove session from local state
      setSessions(prevSessions => prevSessions.filter(s => s.id !== session.id));
      
      Alert.alert('Success', 'Gym session deleted successfully');
    } catch (error) {
      console.error('Error deleting session:', error);
      Alert.alert('Error', 'Failed to delete gym session');
    }
  };

  return (
    <View style={styles.container}>

      <ScrollView style={styles.sessionsContainer}>
        <View style={styles.addContainer}>           
          <TouchableOpacity style={styles.addButton} onPress={handleNewSession}>
            <Text style={styles.plusSign}>+</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <Text style={styles.loadingText}>Loading sessions...</Text>
        ) : sessions.length > 0 ? (
          sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onPress={() => handleSessionPress(session)}
              onLongPress={() => handleSessionLongPress(session)}
            >
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionDate}>{session.session_date}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noSessionsText}>
            No gym sessions yet. Create your first one!
          </Text>
        )}
      </ScrollView>

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
              <Text style={styles.modalTitle}>New Gym Session</Text>
              
              {/* Date Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Session Date:</Text>
                <View style={styles.datePicker}>
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    timeZoneName="America/Detroit"
                    display={Platform.OS === 'ios' ? 'default' : 'calendar'}
                    minimumDate={new Date('2020-01-01')}
                    maximumDate={new Date()}
                    onChange={(event, date) => {
                      if (date) setSelectedDate(date);
                    }}
                  />
                </View>
              </View>
              
              {/* Action Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleCreateSession}
                >
                  <Text style={styles.createButtonText}>Create Session</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
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
    backgroundColor: '#FF6B35',
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
  sessionsContainer: {
    flex: 1,
  },
  sessionCard: {
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
  sessionHeader: {
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sessionName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sessionNotes: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 40,
  },
  noSessionsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 40,
    fontStyle: 'italic',
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
    backgroundColor: '#FF6B35',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
