import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useLayoutEffect } from 'react';
import { Pressable } from 'react-native';

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
        <Pressable
          onPress={onMenuPress} 
          style={{ 
            padding: 8, 
            marginLeft: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            borderWidth: 0,
            shadowOpacity: 0,
            elevation: 0,
          }}
          hitSlop={8}
          android_ripple={undefined}
        >
          <Ionicons name="menu" size={24} color="#ffffff" />
        </Pressable>
      ),
      headerRight: headerRight ?? undefined,
      headerLeftContainerStyle: {
        backgroundColor: 'transparent',
      },
      headerRightContainerStyle: {
        backgroundColor: 'transparent',
      },
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
