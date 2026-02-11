import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SidebarModal from '../../../components/SidebarModal';
import { useHeaderWithMenu } from '../../../hooks/useHeaderWithMenu';
import { supabase } from '../../../lib/supabase';

export default function SleepIndex() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [sleepDates, setSleepDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const limit = 20;

  useHeaderWithMenu({
    title: 'Sleep',
    onMenuPress: () => setIsSidebarVisible(true),
  });

  // Load dates from Sleep table
  const loadSleepDates = useCallback(async (isLoadMore = false) => {
    try {
      const currentOffset = isLoadMore ? offsetRef.current : 0;
      
      if (!isLoadMore) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const { data, error } = await supabase
        .from('Sleep')
        .select('*')
        .order('date', { ascending: false })
        .range(currentOffset, currentOffset + limit - 1);

      if (error) {
        console.error('Error fetching sleep dates:', error);
        return;
      }
      if (!data || data.length === 0) {
        setHasMore(false);
        if (!isLoadMore) {
          setSleepDates([]);
        }
      } else {
        // Extract dates from the response
        const dates = data
          .map(row => row.date)
          .filter((date): date is string => date !== null && date !== undefined);

        if (isLoadMore) {
          setSleepDates(prev => [...prev, ...dates]);
        } else {
          setSleepDates(dates);
        }

        // Check if there are more dates to load
        setHasMore(data.length === limit);
        offsetRef.current = isLoadMore ? offsetRef.current + limit : limit;
      }
    } catch (error) {
      console.error('Error loading sleep dates:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit]);

  const loadMoreDates = async () => {
    if (loadingMore || !hasMore) return;
    await loadSleepDates(true);
  };

  useFocusEffect(
    useCallback(() => {
      loadSleepDates();
    }, [loadSleepDates])
  );

  const handleDatePress = (date: string) => {
    router.push(`/physical-stack/sleep/entry?date=${date}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <Text style={styles.loadingText}>Loading dates...</Text>
        ) : sleepDates.length > 0 ? (
          <View style={styles.datesContainer}>
            {sleepDates.map((date) => (
              <TouchableOpacity 
                key={date} 
                style={styles.dateButton}
                onPress={() => handleDatePress(date)}
              >
                <Text style={styles.dateButtonText}>
                  {date}
                </Text>
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
          <Text style={styles.noDatesText}>No sleep entries yet.</Text>
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
