import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

type TrainingLoadSession = {
  date: string | null;
  trimp: number | null;
  aerobic_training_effect: number | null;
  anaerobic_training_effect: number | null;
};

export default function TrainingLoadSessionScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<TrainingLoadSession | null>(null);

  const loadSession = useCallback(async () => {
    if (!date) {
      setError('Missing date parameter');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You must be logged in to view training load data');
      }

      const { data, error: queryError } = await supabase
        .from('TrainingLoad')
        .select('date, trimp, aerobic_training_effect, anaerobic_training_effect')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('date_received', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (queryError) {
        throw queryError;
      }

      setSessionData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training load data');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [loadSession])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading training load session...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>{date}</Text>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>TRIMP</Text>
        <Text style={styles.metricValue}>{sessionData?.trimp ?? '--'}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>Aerobic Training Effect</Text>
        <Text style={styles.metricValue}>{sessionData?.aerobic_training_effect ?? '--'}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>Anaerobic Training Effect</Text>
        <Text style={styles.metricValue}>{sessionData?.anaerobic_training_effect ?? '--'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    padding: 20,
  },
  loadingText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 20,
  },
  titleText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
    marginBottom: 12,
  },
  metricLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 6,
  },
  metricValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
});
