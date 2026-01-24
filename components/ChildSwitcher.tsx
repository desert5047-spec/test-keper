import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useChild } from '@/contexts/ChildContext';
import { useRouter, usePathname } from 'expo-router';

export function ChildSwitcher() {
  const { selectedChild, children, setSelectedChildId } = useChild();
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleSelectChild = (childId: string) => {
    setSelectedChildId(childId);
    setShowModal(false);

    if (pathname.includes('/detail')) {
      router.replace('/(tabs)/list');
    }
  };

  if (!selectedChild) return null;

  const showChevron = children.length > 1;

  return (
    <>
      <TouchableOpacity
        style={[styles.container, { backgroundColor: selectedChild.color }]}
        onPress={() => showChevron && setShowModal(true)}
        activeOpacity={showChevron ? 0.7 : 1}
        disabled={!showChevron}>
        <Text style={styles.name} numberOfLines={1}>
          {selectedChild.name || '未設定'}
        </Text>
        {showChevron && <ChevronDown size={14} color="#FFF" />}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>子供を選択</Text>

            {children.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={[
                  styles.childOption,
                  selectedChild?.id === child.id && styles.childOptionSelected
                ]}
                onPress={() => handleSelectChild(child.id)}
                activeOpacity={0.7}>
                <View style={styles.childOptionLeft}>
                  <View style={[styles.childBadge, { backgroundColor: child.color }]}>
                    <Text style={styles.childBadgeText}>
                      {child.name?.charAt(0) || '?'}
                    </Text>
                  </View>
                  <View style={styles.childInfo}>
                    <Text style={styles.childName}>{child.name || '未設定'}</Text>
                    {child.grade && (
                      <Text style={styles.childGrade}>小学{child.grade}年</Text>
                    )}
                  </View>
                </View>
                {selectedChild?.id === child.id && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    minHeight: 32,
  },
  name: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#FFF',
    maxWidth: 80,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 16,
  },
  childOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8F8F8',
  },
  childOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  childOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  childBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childBadgeText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
  },
  childGrade: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
  },
});
