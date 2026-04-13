import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { dateFormatter } from '../../assets/helpers/dateFormatter';
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';
import { supabase } from '../../lib/supabase';

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

type TrainingRow = {
  id: string;
  date: string;
};

type GymRow = {
  id: string;
  session_date: string;
};

type FilmRow = {
  id: string;
  date: string;
  type: string | null;
};

export default function DailyStackIndex() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trainingRows, setTrainingRows] = useState<TrainingRow[]>([]);
  const [gymRows, setGymRows] = useState<GymRow[]>([]);
  const [filmRows, setFilmRows] = useState<FilmRow[]>([]);
  const [showGymModal, setShowGymModal] = useState(false);
  const [showFilmModal, setShowFilmModal] = useState(false);
  const [modifyFilmModal, setModifyFilmModal] = useState(false);
  const [editingFilmSessionId, setEditingFilmSessionId] = useState<string | null>(null);
  const [gymModalDate, setGymModalDate] = useState(new Date());
  const [filmModalDate, setFilmModalDate] = useState(new Date());
  const [filmType, setFilmType] = useState('training');
  const [filmDescription, setFilmDescription] = useState('');

  const { date } = useLocalSearchParams<{ date?: string }>();
  const selectedDate = typeof date === 'string' ? date : '';
  const isValid = isIsoDate(selectedDate);
  const headerTitle = useMemo(() => {
    if (!isValid) {
      return 'Daily';
    }

    const parsed = new Date(`${selectedDate}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return 'Daily';
    }

    return parsed.toLocaleDateString(undefined, {
      weekday: 'long',
      //year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [isValid, selectedDate]);
  const today = useMemo(() => new Date(), []);
  const twoYearsAgo = useMemo(() => {
    const dateValue = new Date();
    dateValue.setFullYear(dateValue.getFullYear() - 2);
    return dateValue;
  }, []);

  useHeaderWithMenu({
    title: headerTitle,
    onMenuPress: () => setIsSidebarVisible(true),
  });

  useEffect(() => {
    if (!isValid) {
      return;
    }
    const parsed = new Date(`${selectedDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      setGymModalDate(parsed);
      setFilmModalDate(parsed);
    }
  }, [isValid, selectedDate]);

  const loadDailyData = useCallback(async () => {
    if (!isValid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to load daily data');
      }

      const [{ data: trainingData, error: trainingError }, { data: gymData, error: gymError }, { data: filmData, error: filmError }] =
        await Promise.all([
          supabase
            .from('TrainingLoad')
            .select('id, date')
            .eq('user_id', user.id)
            .eq('date', selectedDate),
            //.order('date_received', { ascending: false }),
          supabase
            .from('GymSessions')
            .select('id, session_date')
            .eq('user_id', user.id)
            .eq('session_date', selectedDate),
            //.order('session_date', { ascending: false }),
          supabase
            .from('FieldSessions')
            .select('id, date, type')
            .eq('user_id', user.id)
            .eq('date', selectedDate)
            //.order('created_at', { ascending: false }),
        ]);

      if (trainingError) throw trainingError;
      if (gymError) throw gymError;
      if (filmError) throw filmError;

      setTrainingRows((trainingData ?? []) as TrainingRow[]);
      setGymRows((gymData ?? []) as GymRow[]);
      setFilmRows((filmData ?? []) as FilmRow[]);
    } catch (error) {
      console.error('Failed to load daily stack data:', error);
      Alert.alert('Error', 'Failed to load daily data');
    } finally {
      setLoading(false);
    }
  }, [isValid, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadDailyData();
    }, [loadDailyData])
  );

  const openSleep = () => {
    router.push(`/daily-stack/sleep/entry?date=${selectedDate}`);
  };

  const openTraining = () => {
    router.push(`/daily-stack/trainingLoad/session?date=${selectedDate}`);
  };

  const openGym = (sessionId: string) => {
    router.push(`/daily-stack/gym/session?id=${sessionId}`);
  };

  const openFilm = (sessionId: string, sessionType: string | null) => {
    router.push(
      `/daily-stack/film/journalEntry?sessionId=${sessionId}&sessionDate=${selectedDate}&sessionType=${sessionType ?? 'training'}`
    );
  };

  const handleCreateGym = async () => {
    try {
      const dateString = dateFormatter(gymModalDate);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create gym sessions');
        return;
      }

      const { data, error } = await supabase
        .from('GymSessions')
        .insert([
          {
            user_id: user.id,
            session_date: dateString,
            data: {},
            note: null,
          },
        ])
        .select('id, session_date')
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to create gym session');
      }

      setShowGymModal(false);
      setGymModalDate(new Date(`${selectedDate}T12:00:00`));
      router.push(`/daily-stack/gym/session?id=${data.id}&sessionDate=${data.session_date ?? dateString}`);
      loadDailyData();
    } catch (error) {
      console.error('Failed to create gym session:', error);
      Alert.alert('Error', 'Failed to create gym session');
    }
  };

  const handleGymSessionLongPress = (session: GymRow) => {
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
          onPress: () => deleteGymSession(session.id),
        },
      ]
    );
  };

  const deleteGymSession = async (sessionId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to delete sessions');
        return;
      }

      const { error } = await supabase
        .from('GymSessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;
      Alert.alert('Success', 'Gym session deleted successfully');
      loadDailyData();
    } catch (error) {
      console.error('Error deleting session:', error);
      Alert.alert('Error', 'Failed to delete gym session');
    }
  };

  const handleCreateFilm = async () => {
    try {
      const dateString = dateFormatter(filmModalDate);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create film sessions');
        return;
      }

      const { data, error } = await supabase
        .from('FieldSessions')
        .insert([
          {
            user_id: user.id,
            date: dateString,
            type: filmType,
            description: filmDescription,
          },
        ])
        .select('id, type')
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to create film session');
      }

      setShowFilmModal(false);
      setFilmType('training');
      setFilmDescription('');
      setFilmModalDate(new Date(`${selectedDate}T12:00:00`));
      router.push(`/daily-stack/film/journalEntry?sessionId=${data.id}&sessionDate=${dateString}&sessionType=${data.type ?? 'training'}`);
      loadDailyData();
    } catch (error) {
      console.error('Failed to create film session:', error);
      Alert.alert('Error', 'Failed to create film session');
    }
  };

  const resetFilmModalFields = () => {
    setFilmModalDate(new Date(`${selectedDate}T12:00:00`));
    setFilmType('training');
    setFilmDescription('');
    setEditingFilmSessionId(null);
  };

  const handleModifyFilm = async () => {
    if (!editingFilmSessionId) return;

    try {
      const dateString = dateFormatter(filmModalDate);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to modify film sessions');
        return;
      }

      const { error } = await supabase
        .from('FieldSessions')
        .update({
          date: dateString,
          type: filmType,
          description: filmDescription,
        })
        .eq('id', editingFilmSessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setModifyFilmModal(false);
      resetFilmModalFields();
      loadDailyData();
    } catch (error) {
      console.error('Failed to modify film session:', error);
      Alert.alert('Error', 'Failed to modify film session');
    }
  };

  const handleFilmSessionLongPress = async (sessionId: string) => {
    if (!sessionId) {
      Alert.alert('Error', 'No session ID found');
      return;
    }

    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This will permanently remove the session, all its actions, and any associated sketches.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Modify',
          style: 'default',
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) {
                Alert.alert('Error', 'You must be logged in to modify sessions');
                return;
              }

              const { data, error } = await supabase
                .from('FieldSessions')
                .select('type, date, description')
                .eq('id', sessionId)
                .eq('user_id', user.id)
                .single();

              if (error || !data) {
                console.error('Error loading field session for edit:', error);
                Alert.alert('Error', 'Failed to load session');
                return;
              }

              setFilmType((data.type as string) || 'training');
              setFilmDescription(typeof data.description === 'string' ? data.description : '');
              const rowDate = data.date as string | null;
              if (rowDate && isIsoDate(rowDate)) {
                setFilmModalDate(new Date(`${rowDate}T12:00:00`));
              }
              setEditingFilmSessionId(sessionId);
              setModifyFilmModal(true);
            } catch (err) {
              console.error('Error loading session for modify:', err);
              Alert.alert('Error', 'Failed to load session');
            }
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: actions, error: fetchActionsError } = await supabase
                .from('FieldActions')
                .select('sketch_id')
                .eq('session_id', sessionId);

              if (fetchActionsError) {
                console.error('Error fetching actions:', fetchActionsError);
                Alert.alert('Error', 'Failed to fetch actions');
                return;
              }

              if (actions && actions.length > 0) {
                const sketchIds = actions.map((action) => action.sketch_id);

                const { error: sketchesError } = await supabase
                  .from('TacticalSketches')
                  .delete()
                  .in('id', sketchIds);

                if (sketchesError) {
                  console.error('Error deleting sketches:', sketchesError);
                  Alert.alert('Error', 'Failed to delete sketches');
                  return;
                }

                const { error: actionsError } = await supabase
                  .from('FieldActions')
                  .delete()
                  .eq('session_id', sessionId);

                if (actionsError) {
                  console.error('Error deleting actions:', actionsError);
                  Alert.alert('Error', 'Failed to delete actions');
                  return;
                }
              }

              const { error: sessionError } = await supabase
                .from('FieldSessions')
                .delete()
                .eq('id', sessionId);

              if (sessionError) {
                console.error('Error deleting session:', sessionError);
                Alert.alert('Error', 'Failed to delete session');
                return;
              }

              Alert.alert('Success', 'Session deleted successfully');
              loadDailyData();
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  const hasTraining = useMemo(() => trainingRows.length > 0, [trainingRows.length]);

  return (
    <View style={styles.container}>
      {isValid && !loading ? (
        <View style={styles.groupContainer}>
          <View style={styles.row}>
            <TouchableOpacity style={styles.circleButton} onPress={openSleep}>
              <Text style={styles.buttonText}>Sleep</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            {hasTraining ? (
              <TouchableOpacity style={styles.circleButton} onPress={openTraining}>
                <Text style={styles.buttonText}>Training</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.row}>
            {gymRows.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.circleButton}
                onPress={() => openGym(session.id)}
                onLongPress={() => handleGymSessionLongPress(session)}
              >
                <Text style={styles.buttonText}>Gym</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.plusButton} onPress={() => setShowGymModal(true)}>
              <Text style={styles.buttonText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            {filmRows.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.circleButton}
                onPress={() => openFilm(session.id, session.type)}
                onLongPress={() => handleFilmSessionLongPress(session.id)}
              >
                <Text style={styles.buttonText}>Film</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.plusButton}
              onPress={() => {
                resetFilmModalFields();
                setShowFilmModal(true);
              }}
            >
              <Text style={styles.buttonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.subtitle}>
          {isValid ? 'Loading daily data...' : 'Select a valid date from the sidebar.'}
        </Text>
      )}

      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />

      <Modal
        visible={showGymModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGymModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Gym Session</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Session Date:</Text>
                <View style={styles.datePicker}>
                  <DateTimePicker
                    value={gymModalDate}
                    mode="date"
                    timeZoneName="America/Detroit"
                    display={Platform.OS === 'ios' ? 'default' : 'calendar'}
                    minimumDate={new Date('2020-01-01')}
                    maximumDate={new Date()}
                    onChange={(event, value) => {
                      if (value) setGymModalDate(value);
                    }}
                  />
                </View>
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowGymModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleCreateGym}
                >
                  <Text style={styles.createButtonText}>Create Session</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showFilmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilmModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Session</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Date:</Text>
                <View style={styles.datePicker}>
                  <DateTimePicker
                    value={filmModalDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'default' : 'calendar'}
                    minimumDate={twoYearsAgo}
                    maximumDate={today}
                    onChange={(event, value) => {
                      if (value) setFilmModalDate(value);
                    }}
                  />
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Type:</Text>
                <View style={styles.typeContainer}>
                  {['training', 'game', 'note', 'other'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        filmType === type && styles.typeButtonSelected
                      ]}
                      onPress={() => setFilmType(type)}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        filmType === type && styles.typeButtonTextSelected
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description (optional):</Text>
                <TextInput
                  style={styles.sessionDescription}
                  value={filmDescription}
                  onChangeText={setFilmDescription}
                  placeholder="e.g. UCL Bayern vs. PSG"
                  keyboardType="default"
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowFilmModal(false);
                    resetFilmModalFields();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleCreateFilm}
                >
                  <Text style={styles.createButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={modifyFilmModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setModifyFilmModal(false);
          resetFilmModalFields();
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Modify Session</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Date:</Text>
                <View style={styles.datePicker}>
                  <DateTimePicker
                    value={filmModalDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'default' : 'calendar'}
                    minimumDate={twoYearsAgo}
                    maximumDate={today}
                    onChange={(event, value) => {
                      if (value) setFilmModalDate(value);
                    }}
                  />
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Type:</Text>
                <View style={styles.typeContainer}>
                  {['training', 'game', 'note', 'other'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        filmType === type && styles.typeButtonSelected
                      ]}
                      onPress={() => setFilmType(type)}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        filmType === type && styles.typeButtonTextSelected
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description (optional):</Text>
                <TextInput
                  style={styles.sessionDescription}
                  value={filmDescription}
                  onChangeText={setFilmDescription}
                  placeholder="e.g. UCL Bayern vs. PSG"
                  keyboardType="default"
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setModifyFilmModal(false);
                    resetFilmModalFields();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleModifyFilm}
                >
                  <Text style={styles.createButtonText}>Modify</Text>
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
  groupContainer: {
    width: '100%',
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 10,
  },
  circleButton: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: '#666',
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  plusButton: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: '#666',
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#e5e5e5',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#b0b0b0',
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
    backgroundColor: '#333',
  },
  cancelButtonText: {
    color: '#e5e5e5',
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
  typeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  typeButton: {
    paddingVertical: 10,
    paddingHorizontal: 5,
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
  sessionDescription: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
});
