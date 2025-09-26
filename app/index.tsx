import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useAppState from 'react-native-useappstate';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  //const [authenticated, setAuthenticated] = useState(false);
  const [session, setSession] = useState(false);

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

    if (appState === "inactive" || "null") {
      console.log("null / inactive")
      return;
    };

    if (appState === "active" && session) {
      "fetch session"
      fetchSession();
    };

    // if (appState === 'background') {
    //   console.log("appState to background");
    //   router.replace('/');
    //   return;
    // }
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
      // Retrieve refresh token
      // const refreshToken = await SecureStore.getItemAsync('refresh_token');
      // if (!refreshToken) {
      //   console.warn("No stored session — user must log in manually first");
      //   return;
      // }
      // // Retrieve access token
      // const accessToken = await SecureStore.getItemAsync('access_token');
      // if (!accessToken) {
      //   console.warn("No stored session — user must log in manually first");
      //   return;
      // }

      // if (result.success) {
      //   const { data, error } = await supabase.auth.setSession({access_token: accessToken, refresh_token: refreshToken });
      //   if (data) {
      //     console.log("TOKENS: ",accessToken, refreshToken);
      //     router.replace('/home');
      //   }
      //   if (error) {
      //     console.error("Failed to restore session", error);
      //     return;
      //   }
      // }
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
      <Button title="FaceID" onPress={handleFaceID} />
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
      <TouchableOpacity 
        style={styles.registerLink}
        onPress={() => router.push('/register')}
      >
        <Text style={styles.registerText}>New user? Register here</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 15,
    padding: 10,
  },
  registerLink: {
    marginTop: 15,
    alignItems: 'center',
  },
  registerText: {
    color: '#007AFF',
    fontSize: 16,
  },
}); 