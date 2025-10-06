import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useLocalSearchParams } from 'expo-router/build/hooks';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useAppState from 'react-native-useappstate';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  //const [authenticated, setAuthenticated] = useState(false);
  const [session, setSession] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const {fromLogout} = useLocalSearchParams<{ fromLogout?: string }>();
  
  // Animation values
  const loginOpacity = useRef(new Animated.Value(0)).current;
  const loginTranslateY = useRef(new Animated.Value(50)).current;

  // Start animation sequence on component mount
  useEffect(() => {
    const startAnimation = () => {
      // Show login elements immediately with animation
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
        setShowLogin(true);
      });
    };

    startAnimation();
  }, []);

  const appState = useAppState();
  useEffect(() => {
    console.log(session);
    const fetchSession = async () => {
      const {data, error} = await supabase.auth.getSession();
      if (data?.session) {
        console.log("appState is active and session is active");
        handleFaceID();
        return;
      } else {
        console.log("Either session is inactive or error thrown");
        Alert.alert("Please enter username and password to activate session");
      }
    };

    if (appState === "active") {
      console.log("active");
      fetchSession();
    };

    if (appState === "inactive" || "null") {
      console.log("null / inactive")
      return;
    };

    if (fromLogout === "true") {
      return;
    }
  }, [appState]);

  const handleFaceID = async () => {
    try {
      console.log("heard");
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Login with Face ID",
        fallbackLabel: "Enter Passcode", // iOS fallback
        disableDeviceFallback: false,
      });
      const {data, error} = await supabase.auth.refreshSession();
      if (error) {
        console.log(error);
        Alert.alert("Please enter username and password to activate session");
        setSession(false);
        return;
      };
      if (result && data?.session?.refresh_token && data?.session?.access_token) {
        await SecureStore.setItemAsync('refresh_token', data.session.refresh_token);
        await SecureStore.setItemAsync('access_token', data.session.access_token);
        //console.log("TOKENS from FaceID login: ",data.session.refresh_token, data.session.access_token);
        setSession(true);
        router.replace('/home');
        return;
      };
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      const accessToken = await SecureStore.getItemAsync('access_token');
      console.log(refreshToken);
      console.log(accessToken);
    } catch (error) {
      Alert.alert('Error');
    }
  };

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
      console.log("Tokens from normal login: ", data.session.refresh_token, data.session.access_token);
      await SecureStore.setItemAsync('refresh_token', data.session.refresh_token);
      await SecureStore.setItemAsync('access_token', data.session.access_token);
      setSession(true);

      if (error) throw error;
      
      // Navigate to home screen after successful login
      router.replace('/home');
    } catch (error) {
      Alert.alert('Error');
    }
  };

  return (
    <View style={styles.container}>
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
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue your journey</Text>
        
        <TouchableOpacity style={styles.faceIdButton} onPress={handleFaceID}>
          <Text style={styles.faceIdText}>🔐 Use Face ID</Text>
        </TouchableOpacity>

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
  );
}

const styles = StyleSheet.create({
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
    borderColor: '#333',
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
    backgroundColor: '#007AFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#007AFF',
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
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
}); 