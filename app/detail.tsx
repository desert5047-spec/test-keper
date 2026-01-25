import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { X, Home, Trash2, Camera, RotateCw, RotateCcw, Edit3, Crop, ArrowLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { TestRecord, RecordType, StampType } from '@/types/database';
import { validateImageUri, isValidImageUri } from '@/utils/imageGuard';
import { AppHeader, HEADER_HEIGHT } from '@/components/AppHeader';
import { uploadImage, deleteImage } from '@/utils/imageUpload';
import { useAuth } from '@/contexts/AuthContext';

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [record, setRecord] = useState<TestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form states
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [evaluationType, setEvaluationType] = useState<'score' | 'stamp'>('score');
  const [score, setScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('100');
  const [stamp, setStamp] = useState<StampType | null>(null);
  const [memo, setMemo] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadRecord(params.id as string);
    }
  }, [params.id]);

  const loadRecord = async (id: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      setRecord(data);
      initializeEditForm(data);
    }
    setLoading(false);
  };

  const initializeEditForm = (data: TestRecord) => {
    setPhotoUri(data.photo_uri);
    setEvaluationType(data.score !== null ? 'score' : 'stamp');
    setScore(data.score?.toString() || '');
    setMaxScore(data.max_score?.toString() || '100');
    setStamp(data.stamp);
    setMemo(data.memo || '');
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

  const handleSave = async () => {
    if (!record) return;

    if (evaluationType === 'score') {
      if (!score.trim()) {
        Alert.alert('エラー', '点数を入れてください');
        return;
      }
      const scoreNum = parseInt(score);
      const maxScoreNum = parseInt(maxScore);
      if (isNaN(scoreNum) || isNaN(maxScoreNum) || scoreNum < 0 || maxScoreNum <= 0) {
        Alert.alert('エラー', '点数は正しい数字で入れてください');
        return;
      }
    } else {
      if (!stamp) {
        Alert.alert('エラー', 'スタンプを選んでください');
        return;
      }
    }

    if (photoUri) {
      try {
        validateImageUri(photoUri);
        if (!isValidImageUri(photoUri)) {
          Alert.alert('エラー', '画像の形式が正しくありません');
          return;
        }
      } catch (error: any) {
        Alert.alert('エラー', error.message);
        return;
      }
    }

    setIsSaving(true);

    try {
      let uploadedImageUrl: string | null = photoUri;

      if (photoUri && photoUri !== record.photo_uri) {
        if (!photoUri.startsWith('http')) {
          try {
            if (!user) {
              Alert.alert('エラー', 'ログインが必要です');
              setIsSaving(false);
              return;
            }
            uploadedImageUrl = await uploadImage(photoUri, user.id);

            if (record.photo_uri) {
              await deleteImage(record.photo_uri);
            }
          } catch (uploadError: any) {
            Alert.alert('エラー', uploadError.message || '画像のアップロードに失敗しました');
            setIsSaving(false);
            return;
          }
        }
      }

      const { error } = await supabase
        .from('records')
        .update({
          score: evaluationType === 'score' ? parseInt(score) : null,
          max_score: evaluationType === 'score' ? parseInt(maxScore) : 100,
          stamp: evaluationType === 'stamp' ? stamp : null,
          memo: memo.trim() || null,
          photo_uri: uploadedImageUrl,
          photo_rotation: 0,
        })
        .eq('id', record.id);

      if (error) throw error;

      await loadRecord(record.id);
      setEditMode(false);
      Alert.alert('成功', '記録を更新しました');
    } catch (error: any) {
      Alert.alert('エラー', error.message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      '記録を削除',
      'この記録を削除しますか？\nこの操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: handleDelete
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!record) return;

    if (record.photo_uri) {
      await deleteImage(record.photo_uri);
    }

    const { error } = await supabase
      .from('records')
      .delete()
      .eq('id', record.id);

    if (error) {
      Alert.alert('エラー', '削除に失敗しました');
    } else {
      router.push('/(tabs)');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const getSubjectColor = (subject: string) => {
    const colors: { [key: string]: string } = {
      '国語': '#E74C3C',
      '算数': '#3498DB',
      '理科': '#27AE60',
      '社会': '#E67E22',
      '英語': '#2C3E50',
      '生活': '#9B59B6',
      '図工': '#F39C12',
      '音楽': '#1ABC9C',
      '体育': '#E91E63',
    };
    return colors[subject] || '#95A5A6';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.container}>
        <AppHeader showBack={true} showChildSwitcher={false} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>記録が見つかりません</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader showBack={true} showChildSwitcher={false} />
      <View style={styles.detailHeader}>
        <View style={styles.detailHeaderActions}>
          {!editMode && (
            <>
              <TouchableOpacity
                onPress={() => setEditMode(true)}
                style={styles.headerIconButton}
                activeOpacity={0.7}>
                <Edit3 size={22} color="#4A90E2" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={styles.headerIconButton}
                activeOpacity={0.7}>
                <Trash2 size={22} color="#E74C3C" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {editMode ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingTop: HEADER_HEIGHT }}
          showsVerticalScrollIndicator={false}>
          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>写真</Text>
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

          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>評価</Text>
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

          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>メモ</Text>
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
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingTop: HEADER_HEIGHT }}
          showsVerticalScrollIndicator={false}>
          {record.photo_uri && isValidImageUri(record.photo_uri) && (
            <TouchableOpacity
              onPress={() => setShowImageModal(true)}
              activeOpacity={0.9}
              style={styles.imageContainer}>
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: record.photo_uri }}
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.content}>
            <View style={styles.infoCard}>
              <View style={[styles.subjectChipLarge, { backgroundColor: getSubjectColor(record.subject) }]}>
                <Text style={styles.subjectChipTextLarge}>{record.subject}</Text>
              </View>

              {record.score !== null ? (
                <Text style={styles.scoreDisplay}>
                  {record.score}点（{record.max_score}点中）
                </Text>
              ) : (
                <Text style={styles.stampDisplay}>{record.stamp}</Text>
              )}

              <Text style={styles.dateDisplay}>{formatDate(record.date)}</Text>
            </View>

            <View style={{ height: 80 }} />
          </View>
        </ScrollView>
      )}

      <View style={styles.bottomButtons}>
        {editMode ? (
          <>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setEditMode(false);
                initializeEditForm(record);
              }}
              activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.7}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>保存</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.homeButton}
              onPress={() => router.push('/')}
              activeOpacity={0.7}>
              <Home size={20} color="#fff" />
              <Text style={styles.homeButtonText}>ホーム</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backBottomButton}
              onPress={() => router.back()}
              activeOpacity={0.7}>
              <ArrowLeft size={20} color="#4A90E2" />
              <Text style={styles.backBottomButtonText}>戻る</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowImageModal(false)}
            activeOpacity={0.7}>
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {record.photo_uri && isValidImageUri(record.photo_uri) && (
            <View style={styles.modalImageWrapper}>
              <Image
                source={{ uri: record.photo_uri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            </View>
          )}
        </View>
      </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  detailHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  detailHeaderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  subjectChipLarge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  subjectChipTextLarge: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
  },
  scoreDisplay: {
    fontSize: 28,
    color: '#333',
    fontFamily: 'Nunito-Bold',
    marginBottom: 16,
  },
  stampDisplay: {
    fontSize: 24,
    color: '#4A90E2',
    fontFamily: 'Nunito-Bold',
    marginBottom: 16,
  },
  dateDisplay: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'Nunito-Regular',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
  },
  label: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontFamily: 'Nunito-SemiBold',
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Nunito-Regular',
  },
  valueHighlight: {
    fontSize: 18,
    color: '#333',
    fontFamily: 'Nunito-Bold',
  },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
  },
  memoText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  editSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  editSectionTitle: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalImageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  bottomButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  homeButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
  },
  backBottomButton: {
    flex: 1,
    backgroundColor: '#F0F8FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A90E2',
    gap: 6,
  },
  backBottomButtonText: {
    color: '#4A90E2',
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
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
});
