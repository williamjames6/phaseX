import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useLayoutEffect } from 'react';
import { TouchableOpacity } from 'react-native';

interface UseHeaderWithMenuProps {
  title: string;
  onMenuPress: () => void;
  headerRight?: () => React.ReactNode;
}

export function useHeaderWithMenu({ title, onMenuPress, headerRight }: UseHeaderWithMenuProps) {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerLeft: () => (
        <TouchableOpacity 
          onPress={onMenuPress} 
          style={{ 
            padding: 8, 
            marginLeft: 8,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Ionicons name="menu" size={24} color="#ffffff" />
        </TouchableOpacity>
      ),
      headerRight: headerRight,
      headerStyle: {
        backgroundColor: '#000',
      },
      headerTintColor: '#ffffff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
  }, [navigation, title, onMenuPress, headerRight]);
}
