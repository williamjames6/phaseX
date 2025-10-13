import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

interface GymSession {
  id: string;
  session_date: string;
  data: any; // JSONB data for storing superset information
}

export default function GymIndex() {
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [loading, setLoading] = useState(true);

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
    router.push('/physical-stack/gym/session');
  };

  const handleSessionPress = (session: GymSession) => {
    router.push(`/physical-stack/gym/session?id=${session.id}`);
  };

  const handleSessionLongPress = (session: GymSession) => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete the gym session from ${formatDate(session.session_date)}? This will permanently remove all exercises and data in this session.`,
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.addContainer}>           
        <TouchableOpacity style={styles.addButton} onPress={handleNewSession}>
          <Text style={styles.plusSign}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.sessionsContainer}>
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
                <Text style={styles.sessionDate}>{formatDate(session.session_date)}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noSessionsText}>
            No gym sessions yet. Create your first one!
          </Text>
        )}
      </ScrollView>
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
});
