import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => index);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);

type TimeField = 'start' | 'end';

function parseTimeString(
  time: string | null,
  defaults: { hours: number; minutes: number }
): { hours: number; minutes: number } {
  if (!time) {
    return defaults;
  }
  const [hourPart, minutePart] = time.split(':');
  const hours = Math.min(23, Math.max(0, parseInt(hourPart, 10) || 0));
  let minutes = parseInt(minutePart, 10) || 0;
  minutes = Math.min(55, Math.round(minutes / 5) * 5);
  if (!MINUTE_OPTIONS.includes(minutes)) {
    minutes = 0;
  }
  return { hours, minutes };
}

function formatTimeParts(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

interface SleepData {
  id?: string;
  date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  time_to_sleep: string | null;
  disruptions: string | null;
  subjective_quality: number | null;
  arousal: string | null;
  note?: string | null;
}

export default function SleepEntry() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [sleepData, setSleepData] = useState<SleepData>({
    date: date || '',
    sleep_start: null,
    sleep_end: null,
    time_to_sleep: null,
    disruptions: null,
    subjective_quality: null,
    arousal: null,
    note: '',
  });
  const [loading, setLoading] = useState(true);
  const [showTimeToSleepModal, setShowTimeToSleepModal] = useState(false);
  const [showDisruptionsModal, setShowDisruptionsModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showArousalModal, setShowArousalModal] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState<TimeField | null>(null);
  const [selectedHours, setSelectedHours] = useState(23);
  const [selectedMinutes, setSelectedMinutes] = useState(0);

  const timeToSleepOptions = ['Short', 'Moderate', 'Long'];
  const arousalOptions = ['Alert', 'Moderate', 'Drowsy'];
  const disruptionsOptions = ['0', '1-2', '>2'];
  const numberOptions = Array.from({ length: 10 }, (_, i) => i); // 0-9

  const loadSleepData = useCallback(async () => {
    if (!date) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to view sleep data');
        return;
      }

      const { data, error } = await supabase
        .from('Sleep')
        .select('*')
        .eq('date', date)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching sleep data:', error);
        return;
      }

      if (data) {
        setSleepData(data);
      }
    } catch (error) {
      console.error('Error loading sleep data:', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      loadSleepData();
    }, [loadSleepData])
  );

  const openTimePicker = (field: TimeField) => {
    const currentTime = field === 'start' ? sleepData.sleep_start : sleepData.sleep_end;
    const defaults = field === 'start' ? { hours: 23, minutes: 0 } : { hours: 7, minutes: 0 };
    const { hours, minutes } = parseTimeString(currentTime, defaults);
    setSelectedHours(hours);
    setSelectedMinutes(minutes);
    setActiveTimeField(field);
  };

  const closeTimePicker = () => {
    setActiveTimeField(null);
  };

  const handleTimePickerConfirm = () => {
    if (activeTimeField == null) {
      closeTimePicker();
      return;
    }

    const formattedTime = formatTimeParts(selectedHours, selectedMinutes);
    const updatedData =
      activeTimeField === 'start'
        ? { ...sleepData, sleep_start: formattedTime }
        : { ...sleepData, sleep_end: formattedTime };

    setSleepData(updatedData);
    saveSleepData(updatedData);
    closeTimePicker();
  };

  const handleTimeToSleepSelect = (value: string) => {
    const updatedData = { ...sleepData, time_to_sleep: value };
    setSleepData(updatedData);
    setShowTimeToSleepModal(false);
    saveSleepData(updatedData);
  };

  const handleDisruptionsSelect = (value: string) => {
    const updatedData = { ...sleepData, disruptions: value };
    setSleepData(updatedData);
    setShowDisruptionsModal(false);
    saveSleepData(updatedData);
  };

  const handleQualitySelect = (value: number) => {
    const updatedData = { ...sleepData, subjective_quality: value };
    setSleepData(updatedData);
    setShowQualityModal(false);
    saveSleepData(updatedData);
  };

  const handleArousalSelect = (value: string) => {
    const updatedData = { ...sleepData, arousal: value };
    setSleepData(updatedData);
    setShowArousalModal(false);
    saveSleepData(updatedData);
  };

  const saveSleepData = async (dataToSave: SleepData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save sleep data');
        return;
      }

      const sleepRecord = {
        sleep_start: dataToSave.sleep_start,
        sleep_end: dataToSave.sleep_end,
        time_to_sleep: dataToSave.time_to_sleep,
        disruptions: dataToSave.disruptions,
        subjective_quality: dataToSave.subjective_quality,
        arousal: dataToSave.arousal,
        note: dataToSave.note || null,
        user_id: user.id,
        date: date,
      };

      if (dataToSave.id) {
        const { error } = await supabase
          .from('Sleep')
          .update(sleepRecord)
          .eq('id', dataToSave.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('Sleep')
          .insert([sleepRecord])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSleepData(prev => ({ ...prev, id: data.id }));
        }
      }
    } catch (error) {
      console.error('Error saving sleep data:', error);
      Alert.alert('Error', 'Failed to save sleep data');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.dateText}>{date}</Text>

        <TextInput
          style={styles.noteInput}
          placeholder="Add a note..."
          placeholderTextColor="#999"
          multiline={true}
          scrollEnabled={false}
          value={sleepData.note ?? ''}
          onChangeText={(text) => setSleepData((prev) => ({ ...prev, note: text }))}
          onBlur={() => {
            setSleepData((prev) => {
              void saveSleepData(prev);
              return prev;
            });
          }}
          textAlignVertical="top"
        />

        {/* Sleep Start Time */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Sleep Start</Text>
          <TouchableOpacity style={styles.timeInput} onPress={() => openTimePicker('start')}>
            <Text style={styles.timeInputText}>
              {sleepData.sleep_start || 'Select time'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sleep End Time */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Sleep End</Text>
          <TouchableOpacity style={styles.timeInput} onPress={() => openTimePicker('end')}>
            <Text style={styles.timeInputText}>
              {sleepData.sleep_end || 'Select time'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Time to Sleep */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Time to Sleep</Text>
          <TouchableOpacity
            style={styles.textInput}
            onPress={() => setShowTimeToSleepModal(true)}
          >
            <Text style={styles.textInputText}>
              {sleepData.time_to_sleep || 'Select option'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Arousal */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Arousal</Text>
          <TouchableOpacity
            style={styles.textInput}
            onPress={() => setShowArousalModal(true)}
          >
            <Text style={styles.textInputText}>
              {sleepData.arousal || 'Select option'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Disruptions */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Disruptions</Text>
          <TouchableOpacity
            style={styles.textInput}
            onPress={() => setShowDisruptionsModal(true)}
          >
            <Text style={styles.textInputText}>
              {sleepData.disruptions || 'Select option'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subjective Quality */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Subjective Quality</Text>
          <TouchableOpacity
            style={styles.textInput}
            onPress={() => setShowQualityModal(true)}
          >
            <Text style={styles.textInputText}>
              {sleepData.subjective_quality !== null ? sleepData.subjective_quality.toString() : 'Select number'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Time to Sleep Modal */}
      <Modal
        visible={showTimeToSleepModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimeToSleepModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Time to Sleep</Text>
              {timeToSleepOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.modalOption,
                    sleepData.time_to_sleep === option && styles.modalOptionSelected
                  ]}
                  onPress={() => handleTimeToSleepSelect(option)}
                >
                  <Text style={[
                    styles.modalOptionText,
                    sleepData.time_to_sleep === option && styles.modalOptionTextSelected
                  ]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowTimeToSleepModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Arousal Modal */}
      <Modal
        visible={showArousalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowArousalModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Arousal</Text>
              {arousalOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.modalOption,
                    sleepData.arousal === option && styles.modalOptionSelected
                  ]}
                  onPress={() => handleArousalSelect(option)}
                >
                  <Text style={[
                    styles.modalOptionText,
                    sleepData.arousal === option && styles.modalOptionTextSelected
                  ]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowArousalModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Disruptions Modal */}
      <Modal
        visible={showDisruptionsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDisruptionsModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Disruptions</Text>
              {disruptionsOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.modalOption,
                    sleepData.disruptions === option && styles.modalOptionSelected
                  ]}
                  onPress={() => handleDisruptionsSelect(option)}
                >
                  <Text style={[
                    styles.modalOptionText,
                    sleepData.disruptions === option && styles.modalOptionTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDisruptionsModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Subjective Quality Modal */}
      <Modal
        visible={showQualityModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQualityModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Subjective Quality</Text>
              <ScrollView style={styles.modalScrollView}>
                {numberOptions.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.modalOption,
                      sleepData.subjective_quality === num && styles.modalOptionSelected
                    ]}
                    onPress={() => handleQualitySelect(num)}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      sleepData.subjective_quality === num && styles.modalOptionTextSelected
                    ]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowQualityModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Sleep Start / End Time Picker */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={activeTimeField !== null}
        onRequestClose={closeTimePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timeModalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeTimePicker}>
                <Text style={styles.modalHeaderText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.timeModalTitle}>
                {activeTimeField === 'start' ? 'Sleep Start' : 'Sleep End'}
              </Text>
              <TouchableOpacity onPress={handleTimePickerConfirm}>
                <Text style={styles.modalHeaderText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickersRow}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Hours</Text>
                <Picker
                  selectedValue={selectedHours}
                  onValueChange={(value) => setSelectedHours(value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {HOUR_OPTIONS.map((option) => (
                    <Picker.Item
                      key={option}
                      label={option.toString().padStart(2, '0')}
                      value={option}
                    />
                  ))}
                </Picker>
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Minutes</Text>
                <Picker
                  selectedValue={selectedMinutes}
                  onValueChange={(value) => setSelectedMinutes(value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {MINUTE_OPTIONS.map((option) => (
                    <Picker.Item
                      key={option}
                      label={option.toString().padStart(2, '0')}
                      value={option}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  scrollContent: {
    padding: 20,
  },
  dateText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  noteInput: {
    width: '100%',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
    color: '#e5e5e5',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  timeInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  timeInputText: {
    color: '#e5e5e5',
    fontSize: 16,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 15,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  textInputText: {
    color: '#e5e5e5',
    fontSize: 16,
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
    maxHeight: '70%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  timeModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    width: '90%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalHeaderText: {
    color: '#0a84ff',
    fontSize: 16,
  },
  timeModalTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pickersRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  picker: {
    width: '100%',
  },
  pickerItem: {
    color: 'white',
    fontSize: 18,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#e5e5e5',
  },
  modalScrollView: {
    width: '100%',
    maxHeight: 300,
  },
  modalOption: {
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  modalOptionSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  modalOptionText: {
    fontSize: 18,
    color: '#e5e5e5',
    fontWeight: '500',
  },
  modalOptionTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  cancelButtonText: {
    color: '#e5e5e5',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
