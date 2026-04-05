import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useChild } from '@/contexts/ChildContext';
import { useRouter, usePathname } from 'expo-router';
import { getGradeDisplayLabel, type SchoolLevel } from '@/lib/subjects';
import { resolveCurrentSchoolInfo } from '@/lib/grade';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 250;
const ANIM_DURATION_OUT = 200;

export function ChildSwitcher() {
  const { selectedChild, children, setSelectedChildId } = useChild();
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (showModal) {
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIM_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: ANIM_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showModal]);

  const closeModal = (onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: ANIM_DURATION_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: ANIM_DURATION_OUT,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowModal(false);
      onDone?.();
    });
  };

  const handleSelectChild = (childId: string) => {
    setSelectedChildId(childId);
    closeModal(() => {
      if (pathname.includes('/detail')) {
        router.replace('/(tabs)/list');
      }
    });
  };

  if (!selectedChild) return null;

  const showChevron = children.length > 1;

  const getDisplayGrade = (child: (typeof children)[number]) => {
    const resolved = resolveCurrentSchoolInfo({
      birthDate: child.birth_date,
      schoolLevel: child.school_level as SchoolLevel,
      grade: child.grade,
    });
    return getGradeDisplayLabel(resolved.schoolLevel, resolved.grade);
  };

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
        animationType="none"
        onRequestClose={() => closeModal()}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeModal()}>
            <Animated.View
              style={[
                styles.backdrop,
                {
                  opacity: backdropOpacity,
                },
              ]}
            />
          </Pressable>
          <Animated.View
            style={[
              styles.sheetWrap,
              {
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
            pointerEvents="auto">
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>子供を選択</Text>

              {children.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childOption,
                    selectedChild?.id === child.id && styles.childOptionSelected,
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
                      {(child.grade || child.birth_date) && (
                        <Text style={styles.childGrade}>{getDisplayGrade(child)}</Text>
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
          </Animated.View>
        </View>
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
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
    color: '#FFF',
    maxWidth: 80,
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
