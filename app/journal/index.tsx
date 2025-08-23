import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface Session {
  id: number;
  date: string;
  type: string;
}

export default function JournalIndex() {
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedType, setSelectedType] = useState('training');
  const limit = 10;

  const loadRecentSessions = async (isLoadMore = false) => {
    try {
      const currentOffset = isLoadMore ? offset : 0;
      
      const { data, error } = await supabase
        .from('Sessions')
        .select('id, date, type')
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
            type: selectedType
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
        router.push(`/journal/journalEntry?sessionId=${data[0].id}`);
      }
      
      // Reset modal state and reload sessions
      setShowModal(false);
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setSelectedType('training');
      loadRecentSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create new session');
    }
  };

  const handleSessionPress = async (session: Session) => {
    try {
      // Navigate to journal entry with the existing session ID
      router.push(`/journal/journalEntry?sessionId=${session.id}`);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <TouchableOpacity style={styles.primaryButton} onPress={handleNewSession}>
        <Text style={styles.primaryButtonText}>New Session</Text>
      </TouchableOpacity>
      
      {loading ? (
        <Text style={styles.loadingText}>Loading sessions...</Text>
      ) : recentSessions.length > 0 ? (
        <View style={styles.sessionsContainer}>
          {recentSessions.map((session) => (
            <TouchableOpacity 
              key={session.id} 
              style={styles.sessionButton}
              onPress={() => handleSessionPress(session)}
            >
              <Text style={styles.sessionButtonText}>
                {formatDate(session.date)} - {session.type.charAt(0).toUpperCase() + session.type.slice(1)}
              </Text>
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
              
              {/* Date Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Date:</Text>
                <TextInput
                  style={styles.dateInput}
                  value={selectedDate}
                  onChangeText={setSelectedDate}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numeric"
                />
              </View>
              
              {/* Type Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Type:</Text>
                <View style={styles.typeContainer}>
                  {['training', 'game', 'other'].map((type) => (
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff3e0',
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
    marginBottom: 30,
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
    paddingHorizontal: 20,
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
}); 