import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { OpenAI } from 'openai';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useAppState from 'react-native-useappstate';
import { chainRunner } from '../../chainRunner';
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
  const timeoutRef = useRef<number | null>(null);

  //auto log out if screen in background for 5 minutes or more
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

    try {

      // Add user's query to chat history
      setChatHistory(prev => [...prev, `You: ${query}`]);
      setQuery(''); // Clear the input after sending
      // Get the current user

      // console.log("SUPABASE: \n\n\n", supabase);
      // console.log("OPENAI: \n\n\n", client);
      const { assistantText } = await chainRunner(
        query,
        supabase,
        client
      );


      // Add assistant's response to chat history
      setChatHistory(prev => [...prev, `Assistant: ${assistantText}`]);
      setResponse(assistantText);

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