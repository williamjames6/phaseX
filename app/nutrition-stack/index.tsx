import Constants from 'expo-constants';
import { OpenAI } from 'openai';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import SidebarModal from '../../components/SidebarModal';
import { useHeaderWithMenu } from '../../hooks/useHeaderWithMenu';
import { supabase } from '../../lib/supabase';

const client = new OpenAI({
  apiKey: Constants.expoConfig?.extra?.openaiApiKey,
  dangerouslyAllowBrowser: true // Required for Expo/React Native
});


export default function NutritionScreen() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [run, setRun] = useState(false);

  const generateEmbedding = async () => {
    if (run) return;

    const {data, error} = await supabase
      .from('Actions')
      .select('description, id, session_id')
      .eq('id', 'aed3b512-da4f-4898-ad30-da55a639d1d2')

    if (error) {
      console.error('Error loading actions:', error);
    }
    console.log(data);

    if (data) {
      for (const a of data) {
        const response = await client.embeddings.create({
          model: "text-embedding-3-small",
          input: a.description,
        });

        if (response) {
          const {data: newData, error: newError} = await supabase
          .from('Actions')
          .upsert([{description_embedding: response.data[0].embedding, id: a.id, session_id: a.session_id}])
          .eq('id', a.id)

          if (newError) {
            console.log(newError);
          }
        }

      }
    };
    setRun(true);

  }


  useHeaderWithMenu({
    title: 'Nutrition',
    onMenuPress: () => setIsSidebarVisible(true),
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Nutrition Module</Text>
        <Text style={styles.subtitle}>Track your meals and nutrition goals</Text>
      </View>
      <Button title="Generate Embedding" onPress={() => generateEmbedding()} />
      <SidebarModal visible={isSidebarVisible} onClose={() => setIsSidebarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e3f2fd',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
}); 