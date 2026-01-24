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
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera, RotateCw, RotateCcw, X, Crop } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { RecordType, StampType } from '@/types/database';
import { validateImageUri, isValidImageUri } from '@/utils/imageGuard';
import { useChild } from '@/contexts/ChildContext';
import { uploadImage } from '@/utils/imageUpload';

const MAIN_SUBJECTS = ['国語', '算数', '理科', '社会', '英語'];

interface Child {
  id: string;
  name: string | null;
  color: string;
}

export default function AddScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedChildId: contextSelectedChildId, children: contextChildren } = useChild();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('国語');
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
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(contextSelectedChildId);

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    if (contextSelectedChildId) {
      setSelectedChildId(contextSelectedChildId);
    }
  }, [contextSelectedChildId]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        validateImageUri(uri);
        if (!isValidImageUri(uri)) {
          Alert.alert('エラー', '画像の読み込みに失敗しました。もう一度選択してください。');
          return;
        }
        setPhotoUri(uri);
      }
    } catch (error: any) {
      Alert.alert('エラー', error.message || '画像の読み込みに失敗しました');
    }
  };

  const takePhoto = async () => {
    setShowPhotoOptions(false);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        validateImageUri(uri);
        if (!isValidImageUri(uri)) {
          Alert.alert('エラー', '画像の読み込みに失敗しました。もう一度選択してください。');
          return;
        }
        setPhotoUri(uri);
      }
    } catch (error: any) {
      Alert.alert('エラー', error.message || '画像の撮影に失敗しました');
    }
  };

  const rotatePhoto = async (direction: 'right' | 'left') => {
    if (!photoUri) return;

    setIsProcessingImage(true);
    try {
      validateImageUri(photoUri);

      const rotation = direction === 'right' ? 90 : -90;
      const result = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ rotate: rotation }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      validateImageUri(result.uri);
      if (!isValidImageUri(result.uri)) {
        throw new Error('回転後の画像が無効です');
      }

      setPhotoUri(result.uri);
    } catch (error: any) {
      Alert.alert('エラー', error.message || '画像の回転に失敗しました');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const cropPhoto = async () => {
    if (!photoUri) return;

    setIsProcessingImage(true);
    try {
      validateImageUri(photoUri);

      // 画像のサイズを取得
      const result = await ImageManipulator.manipulateAsync(
        photoUri,
        [],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 画像の実際のサイズを取得するために一度読み込む
      const imageInfo = await new Promise<{ width: number; height: number }>((resolve) => {
        Image.getSize(
          result.uri,
          (width, height) => resolve({ width, height }),
          () => resolve({ width: 1000, height: 1000 })
        );
      });

      const { width, height } = imageInfo;
      const size = Math.min(width, height);
      const originX = (width - size) / 2;
      const originY = (height - size) / 2;

      // 正方形にトリミング
      const croppedResult = await ImageManipulator.manipulateAsync(
        result.uri,
        [
          {
            crop: {
              originX,
              originY,
              width: size,
              height: size,
            },
          },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      validateImageUri(croppedResult.uri);
      if (!isValidImageUri(croppedResult.uri)) {
        throw new Error('トリミング後の画像が無効です');
      }

      setPhotoUri(croppedResult.uri);
    } catch (error: any) {
      Alert.alert('エラー', error.message || '画像のトリミングに失敗しました');
    } finally {
      setIsProcessingImage(false);
    }
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

  const handleAddOtherSubject = () => {
    if (!newSubject.trim()) return;
    setSelectedSubject(newSubject.trim());
    setNewSubject('');
    setShowSubjectInput(false);
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

  const handleSave = async () => {
    if (!selectedSubject) {
      setErrorMessage('教科を選んでください');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    if (evaluationType === 'score') {
      if (!score.trim()) {
        setErrorMessage('点数を入れてください');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }
      const scoreNum = parseInt(score);
      const maxScoreNum = parseInt(maxScore);
      if (isNaN(scoreNum) || isNaN(maxScoreNum) || scoreNum < 0 || maxScoreNum <= 0) {
        setErrorMessage('点数は正しい数字で入れてください');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }
    } else {
      if (!stamp) {
        setErrorMessage('スタンプを選んでください');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }
    }

    if (!date.trim()) {
      setErrorMessage('日付を入れてください');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    if (photoUri) {
      try {
        validateImageUri(photoUri);
        if (!isValidImageUri(photoUri)) {
          setErrorMessage('画像の形式が正しくありません');
          setTimeout(() => setErrorMessage(''), 3000);
          return;
        }
      } catch (error: any) {
        setErrorMessage(error.message);
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }
    }

    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    setIsSaving(true);

    try {
      let uploadedImageUrl: string | null = null;

      if (photoUri) {
        try {
          uploadedImageUrl = await uploadImage(photoUri, user.id);
        } catch (uploadError: any) {
          Alert.alert('エラー', uploadError.message || '画像のアップロードに失敗しました');
          setIsSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from('records')
        .insert({
          child_id: selectedChildId,
          date,
          subject: selectedSubject,
          type,
          score: evaluationType === 'score' ? parseInt(score) : null,
          max_score: evaluationType === 'score' ? parseInt(maxScore) : 100,
          stamp: evaluationType === 'stamp' ? stamp : null,
          memo: memo.trim() || null,
          photo_uri: uploadedImageUrl,
          photo_rotation: 0,
          user_id: user.id,
        });

      if (error) throw error;

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        resetForm();
        router.push('/(tabs)');
      }, 1500);
    } catch (error: any) {
      Alert.alert('エラー', error.message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setPhotoUri(null);
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
          <Text style={styles.sectionTitle}>写真</Text>
          {photoUri ? (
            <View style={styles.photoContainer}>
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={confirmRemovePhoto}
                activeOpacity={0.7}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.photoWrapper}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              </View>
              {isProcessingImage && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#4A90E2" />
                  <Text style={styles.processingText}>処理中...</Text>
                </View>
              )}
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.rotateButton}
                  onPress={() => rotatePhoto('left')}
                  disabled={isProcessingImage}
                  activeOpacity={0.7}>
                  <RotateCcw size={24} color={isProcessingImage ? '#ccc' : '#666'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rotateButton}
                  onPress={() => rotatePhoto('right')}
                  disabled={isProcessingImage}
                  activeOpacity={0.7}>
                  <RotateCw size={24} color={isProcessingImage ? '#ccc' : '#666'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rotateButton}
                  onPress={cropPhoto}
                  disabled={isProcessingImage}
                  activeOpacity={0.7}>
                  <Crop size={24} color={isProcessingImage ? '#ccc' : '#666'} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoPickerButton}
              onPress={showPhotoActionSheet}
              activeOpacity={0.7}>
              <Camera size={32} color="#4A90E2" />
              <Text style={styles.photoPickerText}>写真を追加</Text>
            </TouchableOpacity>
          )}
        </View>

        {contextChildren.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {contextChildren.find(c => c.id === selectedChildId)?.name || '子供'}の記録
            </Text>
            <View style={styles.childChipContainer}>
              {contextChildren.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childChip,
                    selectedChildId === child.id && styles.childChipSelected,
                  ]}
                  onPress={() => setSelectedChildId(child.id)}
                  activeOpacity={0.7}>
                  <View style={[styles.childColorBadge, { backgroundColor: child.color }]} />
                  <Text
                    style={[
                      styles.childChipText,
                      selectedChildId === child.id && styles.childChipTextSelected,
                    ]}>
                    {child.name || '未設定'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>教科</Text>
          {!showSubjectInput ? (
            <>
              <View style={styles.chipContainer}>
                {MAIN_SUBJECTS.map((subject) => (
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
                placeholder="教科名を入力（例：生活、図工、音楽、体育）"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddOtherSubject}
                activeOpacity={0.7}>
                <Text style={styles.addButtonText}>決定</Text>
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
          <Text style={styles.sectionTitle}>記録方法</Text>
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
                点数で残す
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
                スタンプで残す
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
          <Text style={styles.sectionTitle}>日付</Text>
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>メモ</Text>
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

      <View style={styles.bottomButtonContainer}>
        {errorMessage ? (
          <View style={styles.errorMessageContainer}>
            <Text style={styles.errorMessageText}>{errorMessage}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.bottomSaveButton}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.7}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.bottomSaveButtonText}>保存</Text>
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
    position: 'relative',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  processingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
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
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
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
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  bottomSaveButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSaveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Nunito-Bold',
  },
  errorMessageContainer: {
    backgroundColor: '#FFE5E5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  errorMessageText: {
    color: '#D63031',
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    textAlign: 'center',
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
  childChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    gap: 6,
  },
  childChipSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  childColorBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  childChipText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  childChipTextSelected: {
    color: '#fff',
  },
  unlockModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  unlockModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  unlockModalTitle: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  unlockModalMessage: {
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  unlockModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  unlockModalLaterButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  unlockModalLaterText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    color: '#666',
  },
  unlockModalAddButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
  },
  unlockModalAddText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    color: '#fff',
  },
});
