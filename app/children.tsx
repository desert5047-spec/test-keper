import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Edit3, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useChild } from '@/contexts/ChildContext';
import { supabase } from '@/lib/supabase';
import { deleteImage } from '@/utils/imageUpload';
import { error as logError } from '@/lib/logger';

import { SCHOOL_LEVELS, getGradesForLevel, getGradeDisplayLabel, type SchoolLevel } from '@/lib/subjects';

interface Child {
  id: string;
  name: string | null;
  grade: string | null;
  school_level: SchoolLevel | null;
  color: string;
  is_default: boolean;
}

const COLORS = [
  '#4ECDC4', '#FF6B6B', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B195', '#C06C84'
];

export default function ChildrenScreen() {
  const router = useRouter();
  const { user, familyId, isFamilyReady } = useAuth();
  const { loadChildren: loadContextChildren } = useChild();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [name, setName] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>('elementary');
  const [grade, setGrade] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    if (!user || !isFamilyReady || !familyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('children')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at');

    if (data) {
      setChildren(data);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    if (children.length >= 5) {
      Alert.alert(
        '追加できません',
        '子供は最大5人まで登録できます。'
      );
      return;
    }
    setEditingChild(null);
    setName('');
    setSchoolLevel('elementary');
    setGrade(null);
    setSelectedColor(COLORS[0]);
    setShowModal(true);
  };

  const openEditModal = (child: Child) => {
    setEditingChild(child);
    setName(child.name || '');
    setSchoolLevel(child.school_level || 'elementary');
    setGrade(child.grade ? parseInt(child.grade) : null);
    setSelectedColor(child.color);
    setShowModal(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('エラー', '名前を入力してください');
      return;
    }
    if (trimmedName.length > 4) {
      Alert.alert('エラー', '4文字までで入力してください');
      return;
    }

    if (grade === null) {
      Alert.alert('エラー', '学年を選択してください');
      return;
    }

    // 同じ名前は登録不可（大文字小文字・前後空白を無視して比較）
    const nameLower = trimmedName.toLowerCase();
    const isDuplicate = children.some(
      (c) =>
        c.name?.trim().toLowerCase() === nameLower &&
        (editingChild ? c.id !== editingChild.id : true)
    );
    if (isDuplicate) {
      Alert.alert('エラー', '同じ名前の子供は既に登録されています。別の名前を入力してください。');
      return;
    }

    if (editingChild) {
      const { error } = await supabase
        .from('children')
        .update({
          name: trimmedName,
          grade: grade?.toString(),
          school_level: schoolLevel,
          color: selectedColor,
        })
        .eq('id', editingChild.id)
        .eq('family_id', familyId ?? '');

      if (error) {
        Alert.alert('エラー', '更新に失敗しました');
      } else {
        setShowModal(false);
        await loadChildren();
        await loadContextChildren();
      }
    } else {
      if (!user || !isFamilyReady || !familyId) {
        Alert.alert('エラー', 'ログインが必要です');
        return;
      }

      const { error } = await supabase
        .from('children')
        .insert({
          name: trimmedName,
          grade: grade?.toString(),
          school_level: schoolLevel,
          color: selectedColor,
          is_default: false,
          user_id: user.id,
          family_id: familyId,
        });

      if (error) {
        Alert.alert('エラー', '追加に失敗しました');
      } else {
        setShowModal(false);
        await loadChildren();
        await loadContextChildren();
      }
    }
  };

  const handleDelete = async (child: Child) => {
    if (!child.id) return;

    if (children.length <= 1) {
      Alert.alert(
        '削除できません',
        '最後の1人は削除できません。\n別の子を追加してから削除してください。'
      );
      return;
    }

    Alert.alert(
      '子供を削除',
      `${child.name || '未設定'}を削除しますか？\nこの子供に紐づく記録も削除されます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              // (1) child_id = child.id の records を SELECT（id, photo_uri）
              const { data: records, error: selectErr } = await supabase
                .from('records')
                .select('id, photo_uri')
                .eq('child_id', child.id);
              if (selectErr) {
                logError('[Children] records SELECT', selectErr);
                throw selectErr;
              }

              if (records?.length) {
                const recordIds = records.map((r) => r.id);

                // (2) record_tags を record_id IN (...) で一括 DELETE
                const { error: tagsErr } = await supabase
                  .from('record_tags')
                  .delete()
                  .in('record_id', recordIds);
                if (tagsErr) {
                  logError('[Children] record_tags', tagsErr);
                  throw tagsErr;
                }

                // (3) 各 record の Storage 写真を削除（photo_uri があるものだけ）
                for (const r of records) {
                  if (r.photo_uri) await deleteImage(r.photo_uri);
                }

                // (4) records を child_id = child.id で DELETE
                const { error: recordsErr } = await supabase
                  .from('records')
                  .delete()
                  .eq('child_id', child.id);
                if (recordsErr) {
                  logError('[Children] records', recordsErr);
                  throw recordsErr;
                }
              }

              // 目標を削除
              const { error: goalsErr } = await supabase
                .from('goals')
                .delete()
                .eq('child_id', child.id);
              if (goalsErr) {
                logError('[Children] goals', goalsErr);
                throw goalsErr;
              }

              // 子供を削除
              const { error } = await supabase
                .from('children')
                .delete()
                .eq('id', child.id)
                .eq('family_id', familyId ?? '');
              if (error) {
                logError('[Children] children', error);
                throw error;
              }

              await loadChildren();
              await loadContextChildren();
            } catch (e: any) {
              logError('[Children] 削除例外', e);
              Alert.alert('エラー', e?.message || '削除に失敗しました');
            }
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
      <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            const canGoBack = (router as { canGoBack?: () => boolean }).canGoBack?.();
            if (canGoBack) {
              router.back();
            } else {
              router.replace('/settings');
            }
          }}
          style={styles.backButton}
          activeOpacity={0.7}>
          <View style={styles.backButtonCircle}>
            <ChevronLeft size={22} color="#4A90E2" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>子ども設定</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.description}>
            子どもを追加して、それぞれの記録を管理しましょう。
          </Text>

          {children.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>まだ子供が登録されていません</Text>
              <Text style={styles.emptySubtext}>下のボタンから追加してみましょう</Text>
            </View>
          ) : (
            <View style={styles.childrenList}>
              {children.map((child) => (
                <View key={child.id} style={styles.childCard}>
                  <View style={styles.childCardLeft}>
                    <View style={[styles.colorBadge, { backgroundColor: child.color }]} />
                    <View style={styles.childInfo}>
                      <Text style={styles.childName}>{child.name || '未設定'}</Text>
                      {child.grade && (
                        <Text style={styles.childGrade}>{getGradeDisplayLabel(child.school_level, child.grade)}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.childCardActions}>
                    <TouchableOpacity
                      onPress={() => openEditModal(child)}
                      style={styles.iconButton}
                      activeOpacity={0.7}>
                      <Edit3 size={20} color="#4A90E2" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(child)}
                      style={styles.iconButton}
                      activeOpacity={0.7}>
                      <Trash2 size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomButton}>
        <TouchableOpacity
          style={[styles.addButton, children.length >= 5 && styles.addButtonDisabled]}
          onPress={openAddModal}
          activeOpacity={0.7}
          disabled={children.length >= 5}>
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>
            {children.length >= 5 ? '上限に達しました（5人）' : '子どもを追加'}
          </Text>
        </TouchableOpacity>
      </View>


      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingChild ? '子供を編集' : '子供を追加'}
            </Text>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>なまえ（ニックネーム）</Text>
              <TextInput
                style={styles.modalInput}
                value={name}
                onChangeText={setName}
                placeholder="例：太郎"
                placeholderTextColor="#999"
                maxLength={4}
              />
              <Text style={styles.modalHint}>1〜4文字で入力してください</Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>学校区分</Text>
              <View style={styles.levelRow}>
                {SCHOOL_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level.value}
                    style={[
                      styles.levelButton,
                      schoolLevel === level.value && styles.levelButtonSelected,
                    ]}
                    onPress={() => {
                      setSchoolLevel(level.value);
                      setGrade(null);
                    }}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.levelButtonText,
                        schoolLevel === level.value && styles.levelButtonTextSelected,
                      ]}>
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>
                学年 <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.gradeGrid}>
                {getGradesForLevel(schoolLevel).map((gradeOption) => (
                  <TouchableOpacity
                    key={gradeOption.value}
                    style={[
                      styles.gradeButton,
                      grade === gradeOption.value && styles.gradeButtonSelected,
                    ]}
                    onPress={() => setGrade(gradeOption.value)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.gradeButtonText,
                        grade === gradeOption.value && styles.gradeButtonTextSelected,
                      ]}>
                      {gradeOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>カラー</Text>
              <View style={styles.colorGrid}>
                {COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowModal(false)}
                activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSave}
                activeOpacity={0.7}>
                <Text style={styles.modalSaveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#999',
  },
  childrenList: {
    gap: 12,
  },
  childCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  childCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 2,
  },
  childGrade: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#999',
  },
  childCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  bottomButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  addButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Nunito-Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
  },
  modalHint: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginTop: 4,
  },
  levelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  levelButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
  },
  levelButtonSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#EFF6FF',
  },
  levelButtonText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  levelButtonTextSelected: {
    color: '#4A90E2',
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  gradeButtonSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  gradeButtonText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  gradeButtonTextSelected: {
    color: '#fff',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    color: '#333',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    color: '#fff',
  },
  required: {
    color: '#E74C3C',
  },
});
