import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  ActionSheetIOS,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, RotateCw, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { RecordType, StampType } from '@/types/database';

export default function AddScreen() {
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoRotation, setPhotoRotation] = useState<0 | 90 | 180 | 270>(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [newSubject, setNewSubject] = useState<string>('');
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const [type, setType] = useState<RecordType>('テスト');
  const [evaluationType, setEvaluationType] = useState<'score' | 'stamp'>('score');
  const [score, setScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('100');
  const [stamp, setStamp] = useState<StampType | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    loadSubjects();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
  };

  const loadSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('name')
      .order('created_at');

    if (data) {
      setSubjects(data.map(s => s.name));
      if (data.length > 0) {
        setSelectedSubject(data[0].name);
      }
    }
  };

  const showPhotoActionSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['キャンセル', 'カメラで撮影', 'アルバムから選択'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          }
        }
      );
    } else {
      setShowPhotoOptions(true);
    }
  };

  const pickImage = async () => {
    setShowPhotoOptions(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoRotation(0);
    }
  };

  const takePhoto = async () => {
    setShowPhotoOptions(false);
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoRotation(0);
    }
  };

  const rotatePhoto = () => {
    setPhotoRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  };

  const confirmRemovePhoto = () => {
    Alert.alert(
      '写真を削除',
      '写真を削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => setPhotoUri(null) },
      ]
    );
  };

  const addNewSubject = async () => {
    if (!newSubject.trim()) return;

    const { error } = await supabase
      .from('subjects')
      .insert({ name: newSubject.trim() });

    if (!error) {
      setSubjects([...subjects, newSubject.trim()]);
      setSelectedSubject(newSubject.trim());
      setNewSubject('');
      setShowSubjectInput(false);
    }
  };

  const canSave = () => {
    if (!selectedSubject) return false;
    if (evaluationType === 'score') {
      if (!score.trim()) return false;
      const scoreNum = parseInt(score);
      const maxScoreNum = parseInt(maxScore);
      if (isNaN(scoreNum) || isNaN(maxScoreNum) || scoreNum < 0 || maxScoreNum <= 0) {
        return false;
      }
    } else {
      if (!stamp) return false;
    }
    return true;
  };

  const validateAndSave = async () => {
    if (!canSave()) return;

    setIsSaving(true);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), 8000);
    });

    const savePromise = (async () => {
      const { data: children } = await supabase
        .from('children')
        .select('id')
        .maybeSingle();

      if (!children) {
        throw new Error('子どもデータが見つかりません');
      }

      const { error } = await supabase
        .from('records')
        .insert({
          child_id: children.id,
          date,
          subject: selectedSubject,
          type,
          score: evaluationType === 'score' ? parseInt(score) : null,
          max_score: evaluationType === 'score' ? parseInt(maxScore) : 100,
          stamp: evaluationType === 'stamp' ? stamp : null,
          memo: memo.trim() || null,
          photo_uri: photoUri,
          photo_rotation: photoRotation,
        });

      if (error) throw error;
    })();

    try {
      await Promise.race([savePromise, timeoutPromise]);

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        resetForm();
        router.push('/(tabs)');
      }, 1500);
    } catch (error: any) {
      if (error.message === 'timeout') {
        Alert.alert('エラー', '保存に時間がかかっています。もう一度お試しください。');
      } else {
        Alert.alert('エラー', '保存に失敗しました');
      }
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setPhotoUri(null);
    setPhotoRotation(0);
    setScore('');
    setMaxScore('100');
    setStamp(null);
    setMemo('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>記録を残す</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>写真（任意）</Text>
          {photoUri ? (
            <View style={styles.photoContainer}>
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={confirmRemovePhoto}
                activeOpacity={0.7}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
              <View
                style={[
                  styles.photoWrapper,
                  {
                    transform: [{ rotate: `${photoRotation}deg` }],
                  },
                ]}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.rotateButton}
                  onPress={rotatePhoto}
                  activeOpacity={0.7}>
                  <RotateCw size={24} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoPickerButton}
              onPress={showPhotoActionSheet}
              activeOpacity={0.7}>
              <Camera size={32} color="#4A90E2" />
              <Text style={styles.photoPickerText}>テストの写真を追加（任意）</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>教科（必須）</Text>
          {!showSubjectInput ? (
            <>
              <View style={styles.chipContainer}>
                {subjects.map((subject) => (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.chip,
                      selectedSubject === subject && styles.chipSelected,
                    ]}
                    onPress={() => setSelectedSubject(subject)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.chipText,
                        selectedSubject === subject && styles.chipTextSelected,
                      ]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.chipAdd}
                  onPress={() => setShowSubjectInput(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.chipAddText}>+ その他</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={newSubject}
                onChangeText={setNewSubject}
                placeholder="教科名を入力"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={addNewSubject}
                activeOpacity={0.7}>
                <Text style={styles.addButtonText}>追加</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowSubjectInput(false);
                  setNewSubject('');
                }}
                activeOpacity={0.7}>
                <X size={24} color="#999" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>種類（必須）</Text>
          <View style={styles.chipContainer}>
            {(['テスト', 'プリント', 'ドリル', '確認'] as RecordType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.chip,
                  type === t && styles.chipSelected,
                ]}
                onPress={() => setType(t)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.chipText,
                    type === t && styles.chipTextSelected,
                  ]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>評価（必須）</Text>
          <View style={styles.evaluationTypeContainer}>
            <TouchableOpacity
              style={[
                styles.evaluationTypeButton,
                evaluationType === 'score' && styles.evaluationTypeButtonSelected,
              ]}
              onPress={() => setEvaluationType('score')}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.evaluationTypeText,
                  evaluationType === 'score' && styles.evaluationTypeTextSelected,
                ]}>
                点数で記録
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.evaluationTypeButton,
                evaluationType === 'stamp' && styles.evaluationTypeButtonSelected,
              ]}
              onPress={() => setEvaluationType('stamp')}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.evaluationTypeText,
                  evaluationType === 'stamp' && styles.evaluationTypeTextSelected,
                ]}>
                スタンプで記録
              </Text>
            </TouchableOpacity>
          </View>

          {evaluationType === 'score' ? (
            <View style={styles.scoreInputContainer}>
              <View style={styles.scoreInputRow}>
                <TextInput
                  style={styles.scoreInput}
                  value={score}
                  onChangeText={setScore}
                  placeholder="点数"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <Text style={styles.scoreLabel}>点</Text>
                <Text style={styles.scoreSeparator}>/</Text>
                <TextInput
                  style={styles.maxScoreInput}
                  value={maxScore}
                  onChangeText={setMaxScore}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <Text style={styles.scoreLabel}>点中</Text>
              </View>
            </View>
          ) : (
            <View style={styles.stampContainer}>
              {(['大変よくできました', 'よくできました', 'がんばりました'] as StampType[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.stampButton,
                    stamp === s && styles.stampButtonSelected,
                  ]}
                  onPress={() => setStamp(s)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.stampText,
                      stamp === s && styles.stampTextSelected,
                    ]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>日付（必須）</Text>
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>メモ（任意）</Text>
          <TextInput
            style={styles.memoInput}
            value={memo}
            onChangeText={setMemo}
            placeholder="メモを入力"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#999"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!canSave() || isSaving) && styles.saveButtonDisabled
          ]}
          onPress={validateAndSave}
          disabled={!canSave() || isSaving}
          activeOpacity={0.7}>
          {isSaving ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.saveButtonText}> 保存中…</Text>
            </>
          ) : (
            <Text style={styles.saveButtonText}>保存する</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPhotoOptions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPhotoOptions(false)}>
          <View style={styles.actionSheet}>
            <TouchableOpacity
              style={styles.actionSheetButton}
              onPress={takePhoto}
              activeOpacity={0.7}>
              <Text style={styles.actionSheetButtonText}>カメラで撮影</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetButton}
              onPress={pickImage}
              activeOpacity={0.7}>
              <Text style={styles.actionSheetButtonText}>アルバムから選択</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionSheetButton, styles.actionSheetCancelButton]}
              onPress={() => setShowPhotoOptions(false)}
              activeOpacity={0.7}>
              <Text style={styles.actionSheetCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {showToast && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>記録を残しました</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
    minWidth: 40,
  },
  backButtonText: {
    fontSize: 28,
    color: '#4A90E2',
    fontFamily: 'Nunito-Regular',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    minWidth: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 12,
  },
  photoContainer: {
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  photoWrapper: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 12,
  },
  rotateButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  photoPickerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  photoPickerText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    marginTop: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipAdd: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  chipAddText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#4A90E2',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
  },
  evaluationTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  evaluationTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  evaluationTypeButtonSelected: {
    backgroundColor: '#4A90E2',
  },
  evaluationTypeText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  evaluationTypeTextSelected: {
    color: '#fff',
  },
  scoreInputContainer: {
    alignItems: 'center',
  },
  scoreInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
    textAlign: 'center',
  },
  maxScoreInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
    textAlign: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
  },
  scoreSeparator: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 4,
  },
  stampContainer: {
    gap: 12,
  },
  stampButton: {
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  stampButtonSelected: {
    backgroundColor: '#fff',
    borderColor: '#4A90E2',
  },
  stampText: {
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  stampTextSelected: {
    color: '#4A90E2',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
  },
  memoInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
    minHeight: 100,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  actionSheetButton: {
    paddingVertical: 18,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionSheetCancelButton: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  actionSheetButtonText: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#4A90E2',
  },
  actionSheetCancelText: {
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#666',
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
  },
});
