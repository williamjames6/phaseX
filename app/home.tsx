import Constants from 'expo-constants';
import { Link, router } from 'expo-router';
import { OpenAI } from 'openai';
import React, { useRef, useState } from 'react';
import { Alert, Button, Dimensions, FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

interface InputItem {
  role: string;
  content: string;
}

const { width } = Dimensions.get('window');
const client = new OpenAI({
  apiKey: Constants.expoConfig?.extra?.openaiApiKey,
  dangerouslyAllowBrowser: true // Required for Expo/React Native
});

const modules = [
  { id: 'main', title: 'Main Dashboard', color: '#f0f0f0' },
  { id: 'nutrition', title: 'Nutrition', color: '#e3f2fd' },
  { id: 'physical', title: 'Physical', color: '#f3e5f5' },
  { id: 'video', title: 'Video', color: '#e8f5e9' },
  { id: 'journal', title: 'Journal', color: '#fff3e0' },
];

// Create cyclical data by adding the last item to the start and first item to the end
const cyclicalModules = [
  modules[modules.length - 1],
  ...modules,
  modules[0]
];

export default function HomeScreen() {
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(1);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [chatHistory, setChatHistory] = useState<string[]>([]);

  //make request to openAI API
  const handleSearch = async () => {
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

      // Fetch recent sketches
      const { data: sketches, error } = await supabase
        .from('TacticalSketches')
        .select('description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;

      // Populate inputList with sketch descriptions
      if (sketches) {
        sketches.forEach((sketch, index) => {
          const createdAt = new Date(sketch.created_at).toLocaleString();
          inputList.push({
            role: 'user',
            content: `This is the data from the sketch created at ${createdAt}: ${sketch.description}`
          });
        });
      }

      // Append the user's query
      inputList.push({
        role: 'user',
        content: query
      });

      const response = await client.responses.create({
        model: "gpt-4.1",
        instructions: "You are a helpful assistant that will help me get better at football.",
        input: inputList,
      });
      
      // Add assistant's response to chat history
      setChatHistory(prev => [...prev, `Assistant: ${response.output_text}`]);
      setResponse(response.output_text);
      setQuery(''); // Clear the input after sending

    } catch (error) {
      console.error("Query failed: ", error);
      setChatHistory(prev => [...prev, `Error: ${error}`]);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/');
    } catch (error: unknown) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    }
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / width);
    setCurrentIndex(index);
  };

  const handleMomentumScrollEnd = () => {
    // If we're at the first item (clone), jump to the real first item
    if (currentIndex === 0) {
      flatListRef.current?.scrollToIndex({ index: modules.length, animated: false });
      setCurrentIndex(modules.length);
    }
    // If we're at the last item (clone), jump to the real last item
    else if (currentIndex === modules.length + 1) {
      flatListRef.current?.scrollToIndex({ index: 1, animated: false });
      setCurrentIndex(1);
    }
  };

  const renderModule = ({ item }: { item: typeof modules[0] }) => (
    <View style={[styles.moduleContainer, { backgroundColor: item.color }]}>
      {item.id === 'main' ? (
        <View style={styles.searchContainer}>
          <ScrollView style={styles.chatContainer}>
            {chatHistory.map((message, index) => (
              <Text key={index} style={styles.chatMessage}>{message}</Text>
            ))}
          </ScrollView>
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="How do you want to get better today?"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              multiline={true}
              numberOfLines={4}
              style={styles.textInput}
              textAlignVertical="top"
            />
            <Button title="Submit" onPress={handleSearch} />
          </View>
          <Button title="Logout" onPress={handleLogout} />
        </View>
      ) : (
        <Link href={item.id} style={styles.moduleTitle}>{item.title} </Link>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={cyclicalModules}
        renderItem={renderModule}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        initialScrollIndex={1}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  chatContainer: {
    flex: 1,
    width: '100%',
    marginBottom: 10,
  },
  chatMessage: {
    fontSize: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
  },
  inputContainer: {
    width: '100%',
    gap: 10,
  },
  textInput: {
    width: '100%',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  }
}); 