import { timeSwitch } from '@/assets/helpers/timeSwtich';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { OpenAI } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const rotationValue = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
      if (appState === 'background') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        };
        timeoutRef.current = setTimeout(() => {
          router.replace('/');
          return;
        }, 300000);


      } else if (appState === 'active') {
        // Clear timeout when app becomes active
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
  }, [appState]);

  // Rotation animation effect
  useEffect(() => {
    const startRotation = () => {
      rotationValue.setValue(0);
      Animated.loop(
        Animated.timing(rotationValue, {
          toValue: 1,
          duration: 30000, // 30 seconds for 2 RPM (2 rotations per minute)
          useNativeDriver: true,
        })
      ).start();
    };

    if (chatHistory.length === 0) {
      startRotation();
    } else {
      rotationValue.stopAnimation();
    }
  }, [chatHistory.length, rotationValue]);

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

      //calculate query embedding
      const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      });
      const embedding = Array.from(response.data[0].embedding);
      let similarActions = [];
      if (embedding.length === 1536) {
        const { data, error } = await supabase.rpc('search_similar_actions', {
          query_embedding: embedding,
          //match_threshold: 0.5, // Adjust threshold (0-1, higher = more similar)
          match_count: 15 // Number of results to return
        });

        similarActions = data; //list of objects

        if (error) throw error;
      }

      // Fetch recent actions
      // const { data: actions, error } = await supabase
      //   .from('Actions')
      //   .select('description, time_stamp_seconds, session_date')
      //   .eq('user_id', user.id)
      //   .order('session_date', { ascending: false })
      //   .limit(100);

      // if (error) throw error;

      // Populate inputList with sketch descriptions
      if (similarActions) {
        similarActions.forEach((action: { time_stamp_seconds: any; session_date: any; description: any; }) => {
          console.log(action);
          inputList.push({
            role: 'user',
            content: `This is the data from the action at ${timeSwitch(action.time_stamp_seconds)} from the session on ${action.session_date}: ${action.description}`
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
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        {/* Main Content */}
        <View style={[styles.moduleContainer, { backgroundColor: "black" }]}>
          <View style={styles.searchContainer}>
            <ScrollView 
              style={styles.chatContainer}
              contentContainerStyle={styles.chatContentContainer}
              keyboardShouldPersistTaps="handled"
            >
              {chatHistory.length === 0 ? (
                <View style={styles.animationContainer}>
                  <Animated.View
                    style={[
                      styles.rotatingLogo,
                      {
                        transform: [
                          {
                            rotateY: rotationValue.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Image
                      source={require('../../assets/images/onwards.png')}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </View>
              ) : (
                chatHistory.map((message, index) => (
                  <Text key={index} style={styles.chatMessage}>{message}</Text>
                ))
              )}
            </ScrollView>
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
          </View>
        </View>
      </KeyboardAvoidingView>

      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  moduleContainer: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  moduleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  searchContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 5,
  },
  chatContainer: {
    flex: 1,
    width: '100%',
    marginBottom: 5,
    borderRadius: 8,
  },
  chatContentContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  animationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotatingLogo: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
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