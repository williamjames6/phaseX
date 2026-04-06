import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { setGoogleProviderToken } from '../lib/googleProviderToken';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isSigningIn, setIsSigningIn] = useState(false);
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
        Alert.alert('Please sign in with Google to activate your session');
        return;
      };
      if (result && data?.session?.refresh_token && data?.session?.access_token && data?.user?.id) {
        console.log("USERID from face ID : ", data.user.id);
        router.replace(`/home`);
        return;
      };
    } catch {
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
      
      const {data} = await supabase.auth.getSession();
      if (data?.session && isMountedRef.current) {
        console.log("appState is active and session is active");
        handleFaceID();
        return;
      } else {
        console.log('Session not active. Sign in with Google');
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
  }, [handleFaceID, loginOpacity, loginTranslateY]);

  const ensureMasterSession = async (userId: string) => {
    const { data: existingSessions, error: fetchError } = await supabase
      .from('FieldSessions')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'note')
      .limit(1);

    if (fetchError) {
      console.error('Error checking Master session:', fetchError);
      return;
    }

    if (!existingSessions || existingSessions.length > 0) {
      return;
    }

    const masterSessionId = uuidv4();
    const { error: insertError } = await supabase
      .from('FieldSessions')
      .insert([
        {
          id: masterSessionId,
          user_id: userId,
          type: 'note',
          date: null,
          description: '',
        },
      ]);

    if (insertError) {
      console.error('Error creating Master session:', insertError);
      return;
    }

    console.log('Master session created successfully');
  };

  const handleGoogleLogin = async () => {
    if (isSigningIn) {
      return;
    }

    setIsSigningIn(true);
    try {
      const redirectTo = Linking.createURL('auth/callback', { scheme: 'phasex' });
      console.log('OAuth redirectTo:', redirectTo);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: 'https://www.googleapis.com/auth/gmail.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      console.log("data after signInWithOAuth: ", data);

      if (error) {
        throw error;
      }

      if (!data?.url) {
        Alert.alert('Google sign-in link was not returned');
        return;
      }

      const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (authResult.type !== 'success' || !authResult.url) {
        if (authResult.type !== 'cancel') {
          Alert.alert('Google sign-in was not completed');
        }
        return;
      }

      const callbackUrl = authResult.url;
      const hash = callbackUrl.split('#')[1];
      const hashParams = hash ? new URLSearchParams(hash) : null;
      const accessToken = hashParams?.get('access_token') ?? '';
      const refreshToken = hashParams?.get('refresh_token') ?? '';
      const providerToken = hashParams?.get('provider_token') ?? '';

      if (providerToken) {
        await setGoogleProviderToken(providerToken);
      }

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (setSessionError) {
          throw setSessionError;
        }
      } else {
        const code = new URL(callbackUrl).searchParams.get('code');
        if (!code) {
          throw new Error('OAuth callback did not include session tokens');
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          throw exchangeError;
        }
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user?.id) {
        throw sessionError ?? new Error('Session not available after Google sign-in');
      }

      if (sessionData.session.provider_token) {
        await setGoogleProviderToken(sessionData.session.provider_token);
      }

      await ensureMasterSession(sessionData.session.user.id);
      console.log('USERID from Google login:', sessionData.session.user.id);
      router.replace(`/home`);
    } catch (error) {
      console.error('Google sign-in failed:', error);
      Alert.alert('Error signing in with Google');
    } finally {
      setIsSigningIn(false);
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

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleGoogleLogin}
            disabled={isSigningIn}
          >
            <Text style={styles.loginButtonText}>
              {isSigningIn ? 'Connecting to Google...' : 'Begin Google Deflowering Process'}
            </Text>
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
  logoImage: {
    width: 100,
    height: 100,
  },
}); 
