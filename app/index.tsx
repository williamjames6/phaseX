import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  const handleFaceID = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Login with Face ID",
        fallbackLabel: "Enter Passcode", // iOS fallback
        disableDeviceFallback: false,
      });

      if (result.success) {
        console.log("RESULT: ", result);
        router.replace('/home');
      } else {
        console.log("Authentication failed:", result.error);
      }

    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password,
      });

      if (error) throw error;
      
      // Navigate to home screen after successful login
      router.replace('/home');
    } catch (error) {
      Alert.alert('Error', error.message);
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