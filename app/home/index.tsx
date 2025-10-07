import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { OpenAI } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useAppState from 'react-native-useappstate';
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';
import { supabase } from '../../lib/supabase';
interface InputItem {
  role: string;
  content: string;
}
const { width } = Dimensions.get('window');
const client = new OpenAI({
  apiKey: Constants.expoConfig?.extra?.openaiApiKey,
  dangerouslyAllowBrowser: true // Required for Expo/React Native
});

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const appState = useAppState();

  useEffect(() => {
    if (appState === 'background') {
      router.replace('/');
      return;
    }
  }, [appState]);

  //make request to openAI API
  const handleSearch = async () => {
    Keyboard.dismiss();
    const inputList: InputItem[] = [];

    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to search');
        return;
      }

      // Add user's query to chat history
      setChatHistory(prev => [...prev, `You: ${query}`]);

      // Fetch recent actions
      const { data: actions, error } = await supabase
        .from('Actions')
        .select('description, time_stamp, session_date')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Populate inputList with sketch descriptions
      if (actions) {
        actions.forEach((action, index) => {
          //const createdAt = new Date(action.created_at).toLocaleString();
          inputList.push({
            role: 'user',
            content: `This is the data from the action at ${action.time_stamp} from the session on ${action.session_date}: ${action.description}`
          });
        });
      }

      // Append the user's query
      inputList.push({
        role: 'user',
        content: query
      });

      //console.log(inputList);

      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that will aid the user in trying to improve their performance on the football pitch. Answer questions as briefly as possible while still being friendly. Your job is to tailor your answers as much as possible to the input actions from the user. Focus on actionable ideas the user can implement in their team or personal training.'
        },
        ...inputList.map<ChatCompletionMessageParam>(item => ({
          role: (item.role === 'assistant' || item.role === 'system') ? item.role : 'user',
          content: item.content
        }))
      ];

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages
      });

      const assistantText = completion.choices[0]?.message?.content ?? '';

      // Add assistant's response to chat history
      setChatHistory(prev => [...prev, `Assistant: ${assistantText}`]);
      setResponse(assistantText);
      setQuery(''); // Clear the input after sending

    } catch (error) {
      console.error("Query failed: ", error);
      setChatHistory(prev => [...prev, `Error: ${error}`]);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  useHeaderWithMenu({
    title: 'phaseX',
    onMenuPress: toggleSidebar,
  });

  return (
    <View style={styles.container}>

      {/* Main Content */}
      <View style={[styles.moduleContainer, { backgroundColor: "black" }]}>
        <View style={styles.searchContainer}>
          <ScrollView style={styles.chatContainer}>
            {chatHistory.map((message, index) => (
              <Text key={index} style={styles.chatMessage}>{message}</Text>
            ))}
          </ScrollView>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="How do you want to get better today?"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                multiline={true}
                scrollEnabled={false}
                style={styles.textInput}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity
                onPress={handleSearch}
                activeOpacity={0.8}
                style={styles.sendButton}
              >
                <Ionicons name="arrow-up" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>

      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  moduleContainer: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  moduleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  searchContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    gap: 5,
  },
  chatContainer: {
    flex: 1,
    width: '100%',
    marginBottom: 5,
  },
  chatMessage: {
    fontSize: 16,
    marginBottom: 5,
    padding: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
  },
  inputContainer: {
    //height: 36,
    width: width*.9,
    marginHorizontal: 0,
    paddingRight: 0,
    paddingLeft: 0,
    //position: 'relative',
    //alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 24,
    backgroundColor: 'white',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  textInput: {
    width: '100%',
    paddingHorizontal: 8,
    fontSize: 16,
    //minHeight: 50,
    // minHeight: 44,
    // maxHeight: 160,
  },
  sendButton: {
    // position: 'absolute',
    // right: 14,
    // top: '50%',
    // transform: [{ translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    alignSelf: 'flex-end',
    marginRight: 5,
    marginTop: 5,
    marginBottom: 5
    //marginLeft: 'auto',
    //alignSelf: 'flex-end',
    // paddingRight: 5,
    // paddingBottom: 5,
  },
  sidebarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  sidebarButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 