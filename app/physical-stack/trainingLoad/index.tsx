import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TrainingData {
  id: number;
  subject: string;
  date: string;
  attachments: {
    filename: string;
    parsedContent: {
      text: string;
      numPages: number;
    };
  }[];
}

export default function TrainingLoadIndex() {
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrainingData();
  }, []);

  const fetchTrainingData = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/emails/from/service@firstbeat.fi');
      if (!response.ok) {
        throw new Error('Failed to fetch training data');
      }
      const data = await response.json();
      setTrainingData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading training data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {trainingData.map((training) => (
        <View key={training.id} style={styles.trainingCard}>
          <Text style={styles.subject}>{training.subject}</Text>
          <Text style={styles.date}>{new Date(training.date).toLocaleDateString()}</Text>
          {training.attachments.map((attachment, index) => (
            <View key={index} style={styles.attachment}>
              <Text style={styles.filename}>{attachment.filename}</Text>
              <Text style={styles.content} numberOfLines={3}>
                {attachment.parsedContent.text}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  trainingCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subject: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  attachment: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 6,
  },
  filename: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    color: '#444',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
}); 