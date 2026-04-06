import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SidebarModal from '../../../components/SidebarModal';
import { useHeaderWithMenu } from '../../../hooks/useHeaderWithMenu';
import { supabase } from '../../../lib/supabase';

export default function TrainingLoadIndex() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [trainingDates, setTrainingDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const limit = 20;

  useHeaderWithMenu({
    title: 'Training Load',
    onMenuPress: () => setIsSidebarVisible(true),
  });

  const loadTrainingDates = useCallback(async (isLoadMore = false) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setTrainingDates([]);
        setHasMore(false);
        return;
      }

      const currentOffset = isLoadMore ? offsetRef.current : 0;
      if (!isLoadMore) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const { data, error } = await supabase
        .from('TrainingLoad')
        .select('date')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .range(currentOffset, currentOffset + limit - 1);

      if (error) {
        console.error('Error fetching training load dates:', error);
        return;
      }

      if (!data || data.length === 0) {
        setHasMore(false);
        if (!isLoadMore) {
          setTrainingDates([]);
        }
      } else {
        const dates = data
          .map((row) => row.date)
          .filter((date): date is string => Boolean(date));

        if (isLoadMore) {
          setTrainingDates((prev) => [...prev, ...dates]);
        } else {
          setTrainingDates(dates);
        }

        setHasMore(data.length === limit);
        offsetRef.current = isLoadMore ? offsetRef.current + limit : limit;
      }
    } catch (error) {
      console.error('Error loading training load dates:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadMoreDates = async () => {
    if (loadingMore || !hasMore) {
      return;
    }
    await loadTrainingDates(true);
  };

  useFocusEffect(
    useCallback(() => {
      loadTrainingDates();
    }, [loadTrainingDates])
  );

  const handleDatePress = (date: string) => {
    router.push(`/physical-stack/trainingLoad/session?date=${date}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <Text style={styles.loadingText}>Loading dates...</Text>
        ) : trainingDates.length > 0 ? (
          <View style={styles.datesContainer}>
            {trainingDates.map((date) => (
              <TouchableOpacity
                key={date}
                style={styles.dateButton}
                onPress={() => handleDatePress(date)}
              >
                <Text style={styles.dateButtonText}>{date}</Text>
              </TouchableOpacity>
            ))}

            {hasMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadMoreDates}
                disabled={loadingMore}
              >
                <Text style={styles.loadMoreButtonText}>
                  {loadingMore ? 'Loading...' : 'Load More'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={styles.noDatesText}>No training load entries yet.</Text>
        )}
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
  datesContainer: {
    marginBottom: 30,
  },
  dateButton: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  dateButtonText: {
    color: '#e5e5e5',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 40,
  },
  noDatesText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 40,
    fontStyle: 'italic',
  },
  loadMoreButton: {
    backgroundColor: '#FF6B35',
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
});