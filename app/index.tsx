import * as LocalAuthentication from 'expo-local-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';


export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const fromRegister = useLocalSearchParams().fromRegister;
  const isMountedRef = useRef(true);
  
  // Animation values
  const loginOpacity = useRef(new Animated.Value(0)).current;
  const loginTranslateY = useRef(new Animated.Value(50)).current;
  const hasRunRef = useRef(false);

  

  const handleFaceID = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Login with Face ID",
        fallbackLabel: "Enter Passcode", // iOS fallback
        disableDeviceFallback: false,
      });
      const {data, error} = await supabase.auth.refreshSession();
      if (error) {
        console.log(error);
        Alert.alert("Please enter username and password to activate session");
        return;
      };
      if (result && data?.session?.refresh_token && data?.session?.access_token) {
        router.replace('/home');
        return;
      };
    } catch (error) {
      Alert.alert('Error');
    }
  }, []);

  // Start animation sequence and auto faceID login on component mount
  useEffect(() => {
    // Prevent double execution in development (React Strict Mode) or on remount
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;
    isMountedRef.current = true;

    const startAnimation = () => {
      return new Promise((resolve) => {
        Animated.parallel([
          Animated.timing(loginOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(loginTranslateY, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => {
          resolve(void 0); // ✅ resolves when animation finishes
        });
      });
    };
    const fetchSession = async () => {
      // Check if component is still mounted before proceeding
      if (!isMountedRef.current) return;
      
      const {data, error} = await supabase.auth.getSession();
      if (data?.session && isMountedRef.current) {
        console.log("appState is active and session is active");
        handleFaceID();
        return;
      } else {
        console.log("session not active");
        return;
      }
    };

    const start = async () => {
      await startAnimation();
      if (isMountedRef.current) {
        await fetchSession();
      }
    }
    start();

    // Cleanup function to mark component as unmounted
    return () => {
      console.log('unmounted');
      isMountedRef.current = false;
    };
  }, [handleFaceID]);

  const handleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password,
      });
      if (!data.session?.refresh_token || !data.session?.access_token) {
        Alert.alert('Session data not returned from login');
        return;
      }
      if (fromRegister) {
              // Create Master session for the newly registered user
        if (data.user) {
          const masterSessionId = uuidv4();
          const { error: sessionError } = await supabase
            .from('Sessions')
            .insert([
              {
                id: masterSessionId,
                user_id: data.user.id,
                type: 'note',
                date: null,
                description: ''
              }
            ]);

          if (sessionError) {
            console.error('Error creating Master session:', sessionError);
            // Don't fail registration if Master session creation fails
          } else {
            console.log('Master session created successfully');
          }
        };
      };      
      // Navigate to home screen after successful login
      router.replace('/home');
    } catch (error) {
      Alert.alert('Error');
    }
  };

  const screenHeight = Dimensions.get('window').height;

  return (
    <ScrollView 
      style={styles.scrollViewContainer}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View style={[styles.container, { minHeight: screenHeight }]}>
        {/* Login Elements */}
        <Animated.View 
          style={[
            styles.loginContainer,
            {
              opacity: loginOpacity,
              transform: [{ translateY: loginTranslateY }],
            },
          ]}
        >
          <View> 
            <Image
              source={require('../assets/images/onwards.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onBlur={() => Keyboard.dismiss()}
          />
          
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.registerLink}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.registerText}>New user? Register here</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollViewContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 40,
    textAlign: 'center',
  },
  faceIdButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'yellow',
  },
  faceIdText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#ffffff',
  },
  loginButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: 'yellow',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  registerLink: {
    paddingVertical: 12,
  },
  registerText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  logoImage: {
    width: 100,
    height: 100,
  },
}); 