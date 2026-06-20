import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ensureGlobalSessions } from '../lib/ensureGlobalSessions';
import { supabase } from '../lib/supabase';

interface SidebarModalProps {
  visible: boolean;
  onClose: () => void;
}

const INITIAL_DAY_COUNT = 30;
const LOAD_MORE_DAY_COUNT = 10;

const SIDEBAR_MASTER_KEY = '__sidebar_master__';
const SIDEBAR_SKILL_KEY = '__sidebar_skill__';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MONTH_CODES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDayButtonLabel(isoDate: string): string {
  const [, monthStr, dayStr] = isoDate.split('-');
  const dayNumber = Number(dayStr);
  if (dayNumber !== 1) {
    return String(dayNumber);
  }
  const monthIndex = Number(monthStr) - 1;
  const monthCode = MONTH_CODES[monthIndex] ?? monthStr;
  return `${monthCode} ${dayNumber}`;
}

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
  const [gameDates, setGameDates] = useState<Set<string>>(() => new Set());
  const [masterSessionId, setMasterSessionId] = useState<string | null>(null);
  const [skillSessionId, setSkillSessionId] = useState<string | null>(null);

  const sidebarListData = useMemo(
    () => [SIDEBAR_MASTER_KEY, SIDEBAR_SKILL_KEY, ...dateButtons],
    [dateButtons]
  );

  useEffect(() => {
    if (!visible || dateButtons.length === 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        return;
      }

      await ensureGlobalSessions(user.id);
      if (cancelled) {
        return;
      }

      const dateInList = dateButtons.map((d) => `"${d}"`).join(',');
      const { data, error } = await supabase
        .from('FieldSessions')
        .select('id, date, type, description')
        .eq('user_id', user.id)
        .or(`and(date.is.null,type.eq.note),date.in.(${dateInList})`);

      if (cancelled) {
        return;
      }

      if (error) {
        console.error('SidebarModal: failed to load FieldSessions for day styling:', error);
        return;
      }

      const next = new Set<string>();
      let masterId: string | null = null;
      let skillId: string | null = null;

      for (const row of data ?? []) {
        if (row.type === 'game' && typeof row.date === 'string') {
          next.add(row.date);
        }
        if (row.date === null && row.type === 'note' && typeof row.id === 'string') {
          if (row.description === 'MASTER') {
            masterId = row.id;
          } else if (row.description === 'SKILL') {
            skillId = row.id;
          }
        }
      }
      setGameDates(next);
      setMasterSessionId(masterId);
      setSkillSessionId(skillId);
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, dateButtons]);

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

  const handleGlobalNotePress = (sessionId: string | null) => {
    if (!sessionId) {
      return;
    }
    handleNavigation(
      `/daily-stack/film/journalEntry?sessionId=${sessionId}&sessionDate=null&sessionType=note`
    );
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
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
        <View style={styles.menuContainer} pointerEvents="box-none">
            <View style={styles.dayListContainer}>
              <FlatList
                data={sidebarListData}
                horizontal
                inverted
                style={styles.dayList}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                onEndReachedThreshold={0.9}
                onEndReached={loadMoreDays}
                contentContainerStyle={styles.dayListContent}
                renderItem={({ item }) => {
                  if (item === SIDEBAR_MASTER_KEY) {
                    const enabled = Boolean(masterSessionId);
                    return (
                      <TouchableOpacity
                        style={[
                          styles.dayButton,
                          styles.dayButtonGame,
                          !enabled && styles.dayButtonDisabled,
                        ]}
                        disabled={!enabled}
                        onPress={() => handleGlobalNotePress(masterSessionId)}
                      >
                        <Text style={[styles.dayButtonText, styles.dayButtonTextGame]}>*</Text>
                      </TouchableOpacity>
                    );
                  }
                  if (item === SIDEBAR_SKILL_KEY) {
                    const enabled = Boolean(skillSessionId);
                    return (
                      <TouchableOpacity
                        style={[
                          styles.dayButton,
                          styles.dayButtonGame,
                          !enabled && styles.dayButtonDisabled,
                        ]}
                        disabled={!enabled}
                        onPress={() => handleGlobalNotePress(skillSessionId)}
                      >
                        <Text style={[styles.dayButtonText, styles.dayButtonTextGame]}>doc</Text>
                      </TouchableOpacity>
                    );
                  }

                  const label = formatDayButtonLabel(item);
                  const isFirstOfMonth = Number(item.split('-')[2]) === 1;
                  const isGameDay = gameDates.has(item);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.dayButton,
                        isFirstOfMonth && styles.dayButtonFirstOfMonth,
                        isGameDay && styles.dayButtonGame,
                      ]}
                      onPress={() => handleDatePress(item)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          isFirstOfMonth && styles.dayButtonTextFirstOfMonth,
                          isGameDay && styles.dayButtonTextGame,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            <View style={styles.logoutContainer}>
              <TouchableOpacity style={styles.homeButton} onPress={() => handleNavigation('/home')}>
                <Text style={styles.homeTextStyle}>/\</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logOutTextStyle}>--{'>'}</Text>
              </TouchableOpacity>
            </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menuContainer: {
    flex: 1,
    width: '100%',
  },
  menuItemContainer: {
    width: '100%',
    alignItems: 'center',
  },
  dayListContainer: {
    flex: 1,
    width: '100%',
  },
  dayList: {
    flex: 1,
    width: '100%',
  },
  dayListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.28,
    paddingHorizontal: 16,
    minHeight: SCREEN_HEIGHT * 0.72,
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
  dayButtonFirstOfMonth: {
    width: 72,
    paddingHorizontal: 4,
  },
  dayButtonGame: {
    borderColor: '#fff',
  },
  dayButtonDisabled: {
    opacity: 0.45,
  },
  dayButtonText: {
    fontSize: 22,
    fontWeight: '300',
    color: 'yellow',
  },
  dayButtonTextFirstOfMonth: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  dayButtonTextGame: {
    color: '#fff',
  },
  logoutContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
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
    borderColor: 'white',
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
  homeTextStyle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white'
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
  logOutTextStyle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'red'
  }
});
