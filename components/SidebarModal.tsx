import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

interface SidebarModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SidebarModal({ visible, onClose }: SidebarModalProps) {
  const pathName = usePathname();

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
    if (pathName === route) {
      return;
    } else {
      router.push(route);
    }
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
            <View style={styles.menuItemContainer}>
              <TouchableOpacity 
                style={[styles.menuItem, { backgroundColor: '#f0f0f0' }]}
                onPress={() => handleNavigation('/home')}
              >
                <Ionicons name="home" size={24} color="#333" />
                <Text style={styles.menuText}>Home</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuItemContainer}>
              <TouchableOpacity 
                style={[styles.menuItem, { backgroundColor: '#fff3e0' }]}
                onPress={() => handleNavigation('/physical-stack')}
              >
                <Ionicons name="fitness" size={24} color="#333" />
                <Text style={styles.menuText}>Physical</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuItemContainer}>
              <TouchableOpacity 
                style={[styles.menuItem, { backgroundColor: '#f3e5f5' }]}
                onPress={() => handleNavigation('/journal-stack')}
              >
                <Ionicons name="book" size={24} color="#333" />
                <Text style={styles.menuText}>Journal</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuItemContainer}>
              <TouchableOpacity 
                style={[styles.menuItem, { backgroundColor: '#e3f2fd' }]}
                onPress={() => handleNavigation('/nutrition-stack')}
              >
                <Ionicons name="nutrition" size={24} color="#333" />
                <Text style={styles.menuText}>Nutrition</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuItemContainer}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out" size={20} color="#fff" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
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
  menuItemContainer: {
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
