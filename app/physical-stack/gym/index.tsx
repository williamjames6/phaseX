import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

interface GymSession {
  id: string;
  session_date: string;
  session_name: string | null;
  notes: string | null;
  created_at: string;
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
      <TouchableOpacity style={styles.newSessionButton} onPress={handleNewSession}>
        <Text style={styles.newSessionButtonText}>+ New Session</Text>
      </TouchableOpacity>

      <ScrollView style={styles.sessionsContainer}>
        {loading ? (
          <Text style={styles.loadingText}>Loading sessions...</Text>
        ) : sessions.length > 0 ? (
          sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onPress={() => handleSessionPress(session)}
            >
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionDate}>{formatDate(session.session_date)}</Text>
                {session.session_name && (
                  <Text style={styles.sessionName}>{session.session_name}</Text>
                )}
              </View>
              {session.notes && (
                <Text style={styles.sessionNotes} numberOfLines={2}>
                  {session.notes}
                </Text>
              )}
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
  newSessionButton: {
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  newSessionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
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
