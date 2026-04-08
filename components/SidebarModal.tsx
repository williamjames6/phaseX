import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

interface SidebarModalProps {
  visible: boolean;
  onClose: () => void;
}

const INITIAL_DAY_COUNT = 30;
const LOAD_MORE_DAY_COUNT = 10;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateBatch(startOffset: number, count: number): string[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const dates: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() - (startOffset + i));
    dates.push(toIsoDate(date));
  }

  return dates;
}

export default function SidebarModal({ visible, onClose }: SidebarModalProps) {
  const pathName = usePathname();
  const [dateButtons, setDateButtons] = useState<string[]>(() =>
    buildDateBatch(0, INITIAL_DAY_COUNT)
  );
  const [loadedDayCount, setLoadedDayCount] = useState(INITIAL_DAY_COUNT);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log("Logged out");
      router.replace('/');
    } catch (error: unknown) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    }
  };

  const handleNavigation = (route: string) => {
    onClose();
    if (pathName === route) {
      return;
    } else {
      router.push(route);
    }
  };

  const handleDatePress = (isoDate: string) => {
    handleNavigation(`/daily-stack?date=${isoDate}`);
  };

  const loadMoreDays = useCallback(() => {
    const nextBatch = buildDateBatch(loadedDayCount, LOAD_MORE_DAY_COUNT);
    setDateButtons((prev) => [...prev, ...nextBatch]);
    setLoadedDayCount((prev) => prev + LOAD_MORE_DAY_COUNT);
  }, [loadedDayCount]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.closeArea} onPress={onClose} activeOpacity={1}>
          <View style={styles.menuContainer}>
            <View style={styles.dayListContainer}>
              <FlatList
                data={dateButtons}
                horizontal
                inverted
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                onEndReachedThreshold={0.9}
                onEndReached={loadMoreDays}
                contentContainerStyle={styles.dayListContent}
                renderItem={({ item }) => {
                  const dayNumber = String(Number(item.split('-')[2]));
                  return (
                    <TouchableOpacity
                      style={styles.dayButton}
                      onPress={() => handleDatePress(item)}
                    >
                      <Text style={styles.dayButtonText}>{dayNumber}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            <View style={styles.logoutContainer}>
              <TouchableOpacity style={styles.homeButton} onPress={() => handleNavigation('/home')}>
                <Ionicons name="home" size={22} color="yellow" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  closeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  menuItemContainer: {
    width: '100%',
    alignItems: 'center',
  },
  dayListContainer: {
    width: '100%',
    marginBottom: 20,
  },
  dayListContent: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dayButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderWidth: 1,
    borderColor: 'yellow',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dayButtonText: {
    fontSize: 22,
    fontWeight: '600',
    color: 'yellow',
  },
  logoutContainer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: 'yellow',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoutButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#dc3545',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
