import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Dimensions, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardFormScrollView } from '../../../components/KeyboardFormScrollView';
import { ensureGlobalSessions } from '../../../lib/ensureGlobalSessions';
import { supabase } from '../../../lib/supabase';

const { width } = Dimensions.get('window');

function getGlobalNoteTitle(description: string | null | undefined): string | null {
  if (description === 'MASTER') return 'Master';
  if (description === 'SKILL') return 'Skill';
  return null;
}

export default function NoteIndex() {
  const { noteId, globalKind } = useLocalSearchParams<{ noteId?: string; globalKind?: string }>();
  const navigation = useNavigation();
  const expoRouter = useRouter();
  const isGlobal = typeof globalKind === 'string' && (globalKind === 'MASTER' || globalKind === 'SKILL');
  const resolvedNoteId = Array.isArray(noteId) ? noteId[0] : noteId;
  const resolvedGlobalKind = Array.isArray(globalKind) ? globalKind[0] : globalKind;

  const [dbId, setDbId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionDescription, setSessionDescription] = useState<string | null>(null);
  // Let the user scroll *over* the note field without focusing it: a drag
  // (onTouchMove) makes the field non-editable so the gesture scrolls the
  // KeyboardAwareScrollView instead of placing the caret; a plain tap (no move)
  // leaves it editable and focuses normally.
  const [isEditable, setIsEditable] = useState(true);
  const disableEditing = () => setIsEditable(false);
  const enableEditing = () => setIsEditable(true);

  useLayoutEffect(() => {
    const datedTitle =
      !isGlobal && sessionDescription?.trim() ? sessionDescription.trim() : 'Note';
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              expoRouter.replace('/home');
            }
          }}
          style={styles.headerBackButton}
          hitSlop={8}
          android_ripple={undefined}
        >
          <Ionicons name="chevron-back" size={28} color="#ffffff" />
        </Pressable>
      ),
      title: isGlobal ? (getGlobalNoteTitle(resolvedGlobalKind) ?? 'Note') : datedTitle,
    });
  }, [navigation, expoRouter, isGlobal, resolvedGlobalKind, sessionDescription]);

  const loadNote = useCallback(async () => {
    if (!isGlobal && !resolvedNoteId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      if (isGlobal && resolvedGlobalKind) {
        let { data, error } = await supabase
          .from('Notes')
          .select('id, note, description')
          .eq('user_id', user.id)
          .eq('type', 'global')
          .eq('description', resolvedGlobalKind)
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!data) {
          await ensureGlobalSessions(user.id);
          ({ data, error } = await supabase
            .from('Notes')
            .select('id, note, description')
            .eq('user_id', user.id)
            .eq('type', 'global')
            .eq('description', resolvedGlobalKind)
            .order('id', { ascending: true })
            .limit(1)
            .maybeSingle());
        }

        if (error) {
          console.error('Error loading global note:', error);
          return;
        }

        setSessionDescription(resolvedGlobalKind);
        setDbId(data?.id ?? null);
        setNote(data?.note ?? '');
        return;
      }

      const { data, error } = await supabase
        .from('Notes')
        .select('id, note, description')
        .eq('user_id', user.id)
        .eq('id', resolvedNoteId)
        .maybeSingle();

      if (error || !data) {
        console.error('Error loading note:', error);
        Alert.alert('Error', 'Failed to load note');
        return;
      }

      setSessionDescription(data.description);
      setDbId(data.id);
      setNote(data.note ?? '');
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setLoading(false);
    }
  }, [isGlobal, resolvedGlobalKind, resolvedNoteId]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  useFocusEffect(
    useCallback(() => {
      loadNote();
    }, [loadNote])
  );

  const saveNote = async (noteText: string) => {
    if (!dbId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('Notes')
        .update({ note: noteText })
        .eq('id', dbId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving note:', error);
        Alert.alert('Error', 'Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
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
      <KeyboardFormScrollView
        style={styles.noteScrollView}
        contentContainerStyle={styles.noteScrollContent}
      >
        <View style={styles.noteFieldContainer}>
          <TextInput
            style={styles.noteStyle}
            placeholder=""
            value={note}
            onChangeText={setNote}
            placeholderTextColor="#999"
            onBlur={() => saveNote(note)}
            multiline={true}
            scrollEnabled={false}
            textAlignVertical="top"
            onTouchMove={disableEditing}
            onTouchEnd={enableEditing}
            onTouchCancel={enableEditing}
            editable={isEditable}
          />
        </View>
      </KeyboardFormScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerBackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  noteScrollView: {
    flex: 1,
  },
  noteScrollContent: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  noteFieldContainer: {
    width: width * 0.9,
    marginVertical: 10,
    alignSelf: 'center',
  },
  noteStyle: {
    width: '100%',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    color: '#e5e5e5',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  loadingText: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 50,
    color: '#e5e5e5',
  },
});
