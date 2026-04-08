import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function DailyStackIndex() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const { date } = useLocalSearchParams<{ date?: string }>();
  const selectedDate = typeof date === 'string' ? date : '';
  const isValid = isIsoDate(selectedDate);

  useHeaderWithMenu({
    title: 'Daily',
    onMenuPress: () => setIsSidebarVisible(true),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Stack Scaffold</Text>
      {isValid ? (
        <Text style={styles.dateText}>Selected date: {selectedDate}</Text>
      ) : (
        <Text style={styles.dateText}>No valid date selected.</Text>
      )}
      <Text style={styles.subtitle}>
        Backend migration into this structure will be added next.
      </Text>
      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateText: {
    color: '#e5e5e5',
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});
