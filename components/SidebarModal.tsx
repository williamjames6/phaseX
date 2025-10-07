import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

const { height: screenHeight } = Dimensions.get('window');

interface SidebarModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SidebarModal({ visible, onClose }: SidebarModalProps) {
  // Animation values for each menu item - start from top of screen
  const menuItemAnimations = useRef([
    new Animated.Value(-screenHeight), // Home
    new Animated.Value(-screenHeight), // Physical
    new Animated.Value(-screenHeight), // Journal
    new Animated.Value(-screenHeight), // Nutrition
    new Animated.Value(-screenHeight), // Logout
  ]).current;

  const opacityAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    if (visible) {
      // Reset all animations - start from top of screen
      menuItemAnimations.forEach(anim => anim.setValue(-screenHeight));
      opacityAnimations.forEach(anim => anim.setValue(0));

      // Animate each menu item with a staggered delay
      const animations = menuItemAnimations.map((anim, index) => {
        return Animated.sequence([
          // Initial delay
          Animated.delay(index * 150),
          // Fall down with bounce - more dramatic since falling from top
          Animated.spring(anim, {
            toValue: 0,
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
          // Bounce effect when landing
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 15,
              duration: 120,
              useNativeDriver: true,
            }),
            Animated.spring(anim, {
              toValue: 0,
              tension: 150,
              friction: 3,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });

      const opacityAnims = opacityAnimations.map((anim, index) => {
        return Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: index * 150,
          useNativeDriver: true,
        });
      });

      // Start all animations
      Animated.parallel([
        ...animations,
        ...opacityAnims,
      ]).start();
    } else {
      // Reset animations when modal closes - back to top of screen
      menuItemAnimations.forEach(anim => anim.setValue(-screenHeight));
      opacityAnimations.forEach(anim => anim.setValue(0));
    }
  }, [visible]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log("Logged out");
      router.replace('/');
    } catch (error: unknown) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    }
  };

  const handleNavigation = (route: string) => {
    onClose();
    router.push(route);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.closeArea} onPress={onClose} activeOpacity={1}>
          <View style={styles.menuContainer}>
            <Animated.View
              style={[
                styles.animatedMenuItem,
                {
                  transform: [{ translateY: menuItemAnimations[0] }],
                  opacity: opacityAnimations[0],
                },
              ]}
            >
              <TouchableOpacity 
                style={[styles.menuItem, { backgroundColor: '#f0f0f0' }]}
                onPress={() => handleNavigation('/home')}
              >
                <Ionicons name="home" size={24} color="#333" />
                <Text style={styles.menuText}>Home</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={[
                styles.animatedMenuItem,
                {
                  transform: [{ translateY: menuItemAnimations[1] }],
                  opacity: opacityAnimations[1],
                },
              ]}
            >
              <TouchableOpacity 
                style={[styles.menuItem, { backgroundColor: '#f3e5f5' }]}
                onPress={() => handleNavigation('/physical-stack')}
              >
                <Ionicons name="fitness" size={24} color="#333" />
                <Text style={styles.menuText}>Physical</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={[
                styles.animatedMenuItem,
                {
                  transform: [{ translateY: menuItemAnimations[2] }],
                  opacity: opacityAnimations[2],
                },
              ]}
            >
              <TouchableOpacity 
                style={[styles.menuItem, { backgroundColor: '#fff3e0' }]}
                onPress={() => handleNavigation('/journal-stack')}
              >
                <Ionicons name="book" size={24} color="#333" />
                <Text style={styles.menuText}>Journal</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={[
                styles.animatedMenuItem,
                {
                  transform: [{ translateY: menuItemAnimations[3] }],
                  opacity: opacityAnimations[3],
                },
              ]}
            >
              <TouchableOpacity 
                style={[styles.menuItem, { backgroundColor: '#e3f2fd' }]}
                onPress={() => handleNavigation('/nutrition-stack')}
              >
                <Ionicons name="nutrition" size={24} color="#333" />
                <Text style={styles.menuText}>Nutrition</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={[
                styles.animatedMenuItem,
                {
                  transform: [{ translateY: menuItemAnimations[4] }],
                  opacity: opacityAnimations[4],
                },
              ]}
            >
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out" size={20} color="#fff" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  closeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  animatedMenuItem: {
    width: '100%',
    alignItems: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
    marginBottom: 20,
    borderRadius: 16,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginLeft: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc3545',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    minWidth: 200,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
});
