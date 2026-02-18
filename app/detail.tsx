import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  ActionSheetIOS,
  Animated,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  findNodeHandle,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { X, Home, Trash2, Camera, RotateCw, RotateCcw, Edit3, ArrowLeft, List, Calendar, Plus, Calendar as CalendarIcon, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { CalendarPicker } from '@/components/CalendarPicker';
import { CameraScreen } from '@/components/CameraScreen';
import { CameraPreviewScreen } from '@/components/CameraPreviewScreen';
import { ScoreEditorModal } from '@/components/ScoreEditorModal';
import { FullScoreEditorModal } from '@/components/FullScoreEditorModal';
import { supabase } from '@/lib/supabase';
import type { TestRecord, RecordType, StampType } from '@/types/database';
import { validateImageUri, isValidImageUri } from '@/utils/imageGuard';
import { AppHeader, HEADER_HEIGHT } from '@/components/AppHeader';
import { uploadImage, deleteImage, getSignedImageUrl, getStoragePathFromUrl, normalizePhotoUriForDb } from '@/utils/imageUpload';
import { useAuth } from '@/contexts/AuthContext';
import { log, error as logError } from '@/lib/logger';
import { useChild } from '@/contexts/ChildContext';

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, familyId, isFamilyReady } = useAuth();
  const { children: contextChildren } = useChild();
  const insets = useSafeAreaInsets();
  const [record, setRecord] = useState<TestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPhase, setCameraPhase] = useState<'camera' | 'preview'>('camera');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [scoreError, setScoreError] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [resolvedRecordPhotoUrl, setResolvedRecordPhotoUrl] = useState<string | null>(null);
  const [resolvedEditPhotoUrl, setResolvedEditPhotoUrl] = useState<string | null>(null);

  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScaleRef = useRef(1);
  const baseTranslateX = useRef(new Animated.Value(0)).current;
  const baseTranslateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastTranslateRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef<PinchGestureHandler>(null);
  const panRef = useRef<PanGestureHandler>(null);
  const useNativeDriver = Platform.OS !== 'web';
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver }
  );

  const onPinchStateChange = (event: { nativeEvent: { oldState: number; scale: number } }) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const nextScale = lastScaleRef.current * event.nativeEvent.scale;
      const clampedScale = Math.min(Math.max(nextScale, 1), 3);
      lastScaleRef.current = clampedScale;
      baseScale.setValue(clampedScale);
      pinchScale.setValue(1);
    }
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver }
  );

  const onPanStateChange = (event: { nativeEvent: { oldState: number; translationX: number; translationY: number } }) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const nextX = lastTranslateRef.current.x + event.nativeEvent.translationX;
      const nextY = lastTranslateRef.current.y + event.nativeEvent.translationY;
      lastTranslateRef.current = { x: nextX, y: nextY };
      baseTranslateX.setValue(nextX);
      baseTranslateY.setValue(nextY);
      translateX.setValue(0);
      translateY.setValue(0);
    }
  };

  useEffect(() => {
    if (!showImageModal) {
      lastScaleRef.current = 1;
      baseScale.setValue(1);
      pinchScale.setValue(1);
      lastTranslateRef.current = { x: 0, y: 0 };
      baseTranslateX.setValue(0);
      baseTranslateY.setValue(0);
      translateX.setValue(0);
      translateY.setValue(0);
    }
  }, [showImageModal, baseScale, pinchScale, baseTranslateX, baseTranslateY, translateX, translateY]);

  // Edit form states
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [evaluationType, setEvaluationType] = useState<'score' | 'stamp'>('score');
  const [score, setScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('100');
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showFullScoreModal, setShowFullScoreModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const rowRefMap = useRef<Record<string, View | null>>({});
  const [stamp, setStamp] = useState<string | null>(null);
  const [customStamp, setCustomStamp] = useState<string>('');
  const [showCustomStampInput, setShowCustomStampInput] = useState(false);
  const [memo, setMemo] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [newSubject, setNewSubject] = useState<string>('');
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const MAIN_SUBJECTS = ['国語', '算数', '理科', '社会', '英語'];

  useEffect(() => {
    if (!photoUri) {
      setResolvedEditPhotoUrl(null);
      return;
    }
    if (isValidImageUri(photoUri)) {
      setResolvedEditPhotoUrl(null);
      return;
    }
    let cancelled = false;
    getSignedImageUrl(photoUri).then((resolved) => {
      if (!cancelled && resolved) setResolvedEditPhotoUrl(resolved);
    });
    return () => { cancelled = true; };
  }, [photoUri]);

  useEffect(() => {
    if (params.id && isFamilyReady && familyId) {
      loadRecord(params.id as string);
    }
  }, [params.id, isFamilyReady, familyId]);

  const loadRecord = async (id: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('records')
      .select('*')
      .eq('id', id)
      .eq('family_id', familyId ?? '')
      .maybeSingle();

    if (data) {
      setRecord(data);
      initializeEditForm(data);
      const resolved = data.photo_uri ? await getSignedImageUrl(data.photo_uri) : null;
      setResolvedRecordPhotoUrl(resolved);
    }
    setLoading(false);
  };

  const initializeEditForm = (data: TestRecord) => {
    setPhotoUri(data.photo_uri);
    setEvaluationType(data.score !== null ? 'score' : 'stamp');
    setScore(data.score?.toString() || '');
    setMaxScore(data.max_score?.toString() || '100');
    setStamp(data.stamp);
    setCustomStamp('');
    setShowCustomStampInput(false);
    setMemo(data.memo || '');
    setScoreError('');
    setSelectedSubject(data.subject || '');
    setSelectedChildId(data.child_id || null);
    if (data.subject && !MAIN_SUBJECTS.includes(data.subject)) {
      setShowSubjectInput(true);
      setNewSubject(data.subject);
    } else {
      setShowSubjectInput(false);
      setNewSubject('');
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
  }, []);

  const handleOtherSubjectChange = (value: string) => {
    setNewSubject(value);
    if (value.trim().length >= 2) {
      setSelectedSubject(value.trim());
    }
  };

  const validateScore = (scoreValue: string, maxScoreValue: string) => {
    if (!scoreValue || !maxScoreValue) {
      setScoreError('');
      return;
    }

    const scoreNum = parseInt(scoreValue);
    const maxScoreNum = parseInt(maxScoreValue);

    if (isNaN(scoreNum) || isNaN(maxScoreNum)) {
      setScoreError('正しい数字を入力してください');
      return;
    }

    if (scoreNum < 0) {
      setScoreError('点数は0以上で入力してください');
      return;
    }

    if (maxScoreNum <= 0) {
      setScoreError('満点は1以上で入力してください');
      return;
    }

    if (scoreNum > maxScoreNum) {
      setScoreError(`エラー: 得点(${scoreNum}点)が満点(${maxScoreNum}点)を超えています`);
      return;
    }

    setScoreError('');
  };

  const formatDisplayDate = (dateString: string) => {
    try {
      const [year, month, day] = dateString.split('-');
      return `${year}年${parseInt(month)}月${parseInt(day)}日`;
    } catch {
      return dateString;
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

  const takePhoto = () => {
    setShowPhotoOptions(false);
    setCameraPhase('camera');
    setPreviewUri(null);
    setShowCamera(true);
  };

  const handleCameraCapture = (uri: string) => {
    try {
      validateImageUri(uri);
      if (!isValidImageUri(uri)) {
        Alert.alert('エラー', '画像の形式が正しくありません');
        return;
      }
      setPreviewUri(uri);
      setCameraPhase('preview');
    } catch (error: any) {
      Alert.alert('エラー', error?.message || '画像の処理に失敗しました');
    }
  };

  const handlePreviewSave = () => {
    if (previewUri) setPhotoUri(previewUri);
    setShowCamera(false);
    setCameraPhase('camera');
    setPreviewUri(null);
  };

  const handlePreviewRetake = () => {
    setCameraPhase('camera');
    setPreviewUri(null);
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
    setCameraPhase('camera');
    setPreviewUri(null);
  };

  // Web: fetch → blob URL → Canvas で回転（blob: の場合は fetch 不要）
  const rotateImageWithCanvas = (imageUrl: string, degrees: number): Promise<string> => {
    const FETCH_TIMEOUT_MS = 10000;
    const TOTAL_TIMEOUT_MS = 20000;
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('Web 環境で回転を実行できません'));
        return;
      }
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };
      const totalTimeoutId = setTimeout(() => {
        settle(() => reject(new Error('画像の処理がタイムアウトしました')));
      }, TOTAL_TIMEOUT_MS);

      const runWithImage = (srcUrl: string, revokeBlobUrl?: string) => {
        const img = new Image();
        img.onload = () => {
          try {
            if (revokeBlobUrl) URL.revokeObjectURL(revokeBlobUrl);
            const canvas = document.createElement('canvas');
            const rad = (degrees * Math.PI) / 180;
            const cos = Math.abs(Math.cos(rad));
            const sin = Math.abs(Math.sin(rad));
            canvas.width = Math.floor(img.width * cos + img.height * sin);
            canvas.height = Math.floor(img.width * sin + img.height * cos);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              clearTimeout(totalTimeoutId);
              settle(() => reject(new Error('Canvas 2d が利用できません')));
              return;
            }
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rad);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            canvas.toBlob(
              (resultBlob) => {
                clearTimeout(totalTimeoutId);
                if (settled) return;
                settled = true;
                if (!resultBlob) {
                  reject(new Error('回転後の画像の生成に失敗しました'));
                  return;
                }
                resolve(URL.createObjectURL(resultBlob));
              },
              'image/jpeg',
              0.5
            );
          } catch (e) {
            clearTimeout(totalTimeoutId);
            settle(() => reject(e instanceof Error ? e : new Error('回転処理でエラーが発生しました')));
          }
        };
        img.onerror = () => {
          clearTimeout(totalTimeoutId);
          if (revokeBlobUrl) URL.revokeObjectURL(revokeBlobUrl);
          settle(() => reject(new Error('画像の読み込みに失敗しました')));
        };
        img.src = srcUrl;
      };

      if (imageUrl.startsWith('blob:')) {
        runWithImage(imageUrl);
        return;
      }

      const controller = new AbortController();
      const fetchTimeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      fetch(imageUrl, { mode: 'cors', signal: controller.signal })
        .then((res) => {
          clearTimeout(fetchTimeoutId);
          if (!res.ok) throw new Error('画像の取得に失敗しました');
          return res.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          runWithImage(blobUrl, blobUrl);
        })
        .catch((err) => {
          clearTimeout(fetchTimeoutId);
          clearTimeout(totalTimeoutId);
          const msg =
            err?.name === 'AbortError'
              ? '画像の取得がタイムアウトしました。ネットワークまたは Supabase Storage の CORS 設定をご確認ください。'
              : err instanceof Error
                ? err.message
                : '画像の取得に失敗しました。CORS設定をご確認ください。';
          settle(() => reject(new Error(msg)));
        });
    });
  };

  const rotatePhoto = async (direction: 'right' | 'left') => {
    if (!photoUri) return;

    setIsProcessingImage(true);
    try {
      // 編集時は photoUri が DB のパス（recordId/xxx.jpg）のことがある → 回転には読み込み可能な URL が必要
      let uriToRotate = photoUri;
      if (!isValidImageUri(photoUri)) {
        const signed = await getSignedImageUrl(photoUri);
        if (!signed) {
          Alert.alert('エラー', '画像の読み込みに失敗しました');
          return;
        }
        uriToRotate = signed;
      } else {
        validateImageUri(photoUri);
      }

      const rotation = direction === 'right' ? 90 : -90;

      if (Platform.OS === 'web' && (uriToRotate.startsWith('http://') || uriToRotate.startsWith('https://'))) {
        const blobUrl = await rotateImageWithCanvas(uriToRotate, rotation);
        validateImageUri(blobUrl);
        if (!isValidImageUri(blobUrl)) {
          throw new Error('回転後の画像が無効です');
        }
        setPhotoUri(blobUrl);
        return;
      }

      // ネイティブ: ImageManipulator は file:// を要求するため、https の場合は一旦ローカルに保存してから回転
      let localUri = uriToRotate;
      if (uriToRotate.startsWith('http://') || uriToRotate.startsWith('https://')) {
        const cachePath = `${FileSystem.cacheDirectory}temp-rotate-${Date.now()}.jpg`;
        const downloadResult = await FileSystem.downloadAsync(uriToRotate, cachePath);
        if (!downloadResult?.uri) throw new Error('画像のダウンロードに失敗しました');
        localUri = downloadResult.uri;
      }

      const result = await ImageManipulator.manipulateAsync(
        localUri,
        [{ rotate: rotation }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      validateImageUri(result.uri);
      if (!isValidImageUri(result.uri)) {
        throw new Error('回転後の画像が無効です');
      }

      setPhotoUri(result.uri);
    } catch (error: any) {
      logError('[回転]', error);
      Alert.alert('エラー', error.message || '画像の回転に失敗しました');
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
    if (!isFamilyReady || !familyId) {
      Alert.alert('エラー', '家族情報の取得中です。少し待ってから再度お試しください');
      return;
    }
    if (!selectedSubject) {
      Alert.alert('エラー', '教科を選んでください');
      return;
    }

    // 写真・点数・スタンプのいずれかがあれば保存可能（既存の record.photo_uri も写真ありとみなす）
    const hasPhoto = !!(photoUri && (isValidImageUri(photoUri) || record?.photo_uri));
    const hasValidScore =
      evaluationType === 'score' &&
      score.trim() !== '' &&
      !scoreError &&
      !isNaN(parseInt(score)) &&
      parseInt(score) >= 0 &&
      parseInt(maxScore) > 0 &&
      parseInt(score) <= parseInt(maxScore);
    const hasStamp = evaluationType === 'stamp' && !!stamp;

    if (!hasPhoto && !hasValidScore && !hasStamp) {
      Alert.alert(
        'エラー',
        '写真、点数、スタンプのいずれかを入力してください'
      );
      return;
    }

    if (evaluationType === 'score' && score.trim() !== '') {
      const scoreNum = parseInt(score);
      const maxScoreNum = parseInt(maxScore);
      if (isNaN(scoreNum) || isNaN(maxScoreNum) || scoreNum < 0 || maxScoreNum <= 0) {
        Alert.alert('エラー', '点数は正しい数字で入れてください');
        return;
      }
      if (scoreNum > maxScoreNum) {
        Alert.alert('エラー', `点数は${maxScoreNum}点以下で入力してください`);
        return;
      }
    }

    if (contextChildren.length > 0 && !selectedChildId) {
      Alert.alert('エラー', '子供を選択してください');
      return;
    }

    if (photoUri && isValidImageUri(photoUri)) {
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
      let uploadedImagePath: string | null = null;

      if (photoUri && photoUri !== record.photo_uri) {
        if (photoUri.startsWith('file://') || photoUri.startsWith('content://') || (photoUri.startsWith('http') && photoUri.includes('blob:'))) {
          try {
            if (!user) {
              Alert.alert('エラー', 'ログインが必要です');
              setIsSaving(false);
              return;
            }
            const path = await uploadImage(photoUri, record.id);
            log('[SAVE][detail] upload result path:', path);
            uploadedImagePath = path;

            if (record.photo_uri) {
              const pathToDelete = normalizePhotoUriForDb(record.photo_uri) ?? record.photo_uri;
              await deleteImage(pathToDelete);
            }
          } catch (uploadError: any) {
            logError('[記録更新] 画像アップロードエラー');
            Alert.alert('エラー', '画像のアップロードに失敗しました');
            setIsSaving(false);
            return;
          }
        } else {
          uploadedImagePath = record.photo_uri;
        }
      } else {
        uploadedImagePath = record.photo_uri;
      }

      const photoUriToDb: string | null = uploadedImagePath
        ? /^https?:\/\//.test(uploadedImagePath)
          ? getStoragePathFromUrl(uploadedImagePath)
          : (normalizePhotoUriForDb(uploadedImagePath) ?? uploadedImagePath)
        : null;
      log('[SAVE][detail] photo_uri to DB (path only):', photoUriToDb);

      const { error } = await supabase
        .from('records')
        .update({
          child_id: selectedChildId ?? null,
          subject: selectedSubject,
          date: record.date,
          score: evaluationType === 'score' && score.trim() ? parseInt(score, 10) : null,
          max_score: evaluationType === 'score' && score.trim() ? parseInt(maxScore, 10) : 100,
          stamp: evaluationType === 'stamp' && stamp ? stamp : null,
          memo: memo.trim() || null,
          photo_uri: photoUriToDb,
          photo_rotation: 0,
        })
        .eq('id', record.id)
        .eq('family_id', familyId ?? '');

      if (error) throw error;

      await loadRecord(record.id);
      setEditMode(false);
      Alert.alert('成功', '記録を更新しました');
    } catch (error: any) {
      logError('[記録更新] 保存エラー');
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const scrollToRecord = (recordId: string) => {
    const rowEl = rowRefMap.current[recordId];
    const scrollEl = scrollViewRef.current;
    if (!rowEl || !scrollEl) return;
    const scrollNode = findNodeHandle(scrollEl as any);
    if (!scrollNode) return;
    requestAnimationFrame(() => {
      (rowEl as any).measureLayout(
        scrollNode,
        (_x: number, y: number) => {
          scrollEl.scrollTo({ y: Math.max(0, y - 120), animated: true });
          setTimeout(() => {
            scrollEl.scrollTo({ y: Math.max(0, y - 120), animated: true });
          }, 80);
        },
        () => {}
      );
    });
  };

  const openScoreModal = () => {
    if (record) scrollToRecord(record.id);
    setShowScoreModal(true);
  };

  const handleScoreModalConfirm = async (value: number | null) => {
    if (!record || !familyId) return;
    const maxScoreNum = parseInt(maxScore, 10) || record.max_score || 100;
    setScore(value != null ? String(value) : '');
    setRecord((prev) => (prev ? { ...prev, score: value, max_score: maxScoreNum } : null));
    setScoreError('');
    setShowScoreModal(false);
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('records')
        .update({
          score: value,
          max_score: maxScoreNum,
        })
        .eq('id', record.id)
        .eq('family_id', familyId);

      if (error) throw error;
    } catch (err: any) {
      logError('[記録更新] 点数更新エラー', err);
      Alert.alert('エラー', '点数の更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm('この記録を削除しますか？\n\nこの操作は取り消せません。');
      if (ok) handleDelete();
      return;
    }

    Alert.alert(
      '記録を削除',
      'この記録を削除しますか？\nこの操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: handleDelete },
      ]
    );
  };

  const handleDelete = async () => {
    if (!record) return;

    try {
      // (1) record_tags を record_id = record.id で DELETE
      const { error: tagsError } = await supabase
        .from('record_tags')
        .delete()
        .eq('record_id', record.id);
      if (tagsError) {
        logError('[記録削除] record_tags', tagsError);
        throw tagsError;
      }

      // (2) Storage の写真を削除（photo_uri がある場合のみ）
      if (record.photo_uri) {
        await deleteImage(record.photo_uri);
      }

      // (3) records を id AND family_id で DELETE（行削除のみ。UPDATEはしない）
      const { error } = await supabase
        .from('records')
        .delete()
        .eq('id', record.id)
        .eq('family_id', familyId ?? '');
      if (error) {
        logError('[記録削除] records', error);
        throw error;
      }

      router.push('/(tabs)');
    } catch (e: any) {
      logError('[記録削除] 削除例外', e);
      if (Platform.OS === 'web') {
        window.alert('エラー: 削除に失敗しました');
      } else {
        Alert.alert('エラー', '削除に失敗しました');
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
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

  const recordPhotoDisplayUri =
    resolvedRecordPhotoUrl || (record?.photo_uri && isValidImageUri(record.photo_uri) ? record.photo_uri : null);
  const editPhotoDisplayUri =
    photoUri && isValidImageUri(photoUri) ? photoUri : resolvedEditPhotoUrl;

  // 編集時：写真・点数・スタンプのいずれかがあれば保存ボタン有効
  // 写真あり = 新規選択のURI(file/https) または 既存の record.photo_uri（DBのパスは isValidImageUri で false になるため別判定）
  const hasPhotoInEdit = !!(
    photoUri &&
    (isValidImageUri(photoUri) || record?.photo_uri)
  );
  const canSaveInEdit =
    hasPhotoInEdit ||
    (evaluationType === 'score' &&
      score.trim() !== '' &&
      !scoreError &&
      !isNaN(parseInt(score, 10)) &&
      parseInt(score, 10) >= 0 &&
      parseInt(maxScore, 10) > 0 &&
      parseInt(score, 10) <= parseInt(maxScore, 10)) ||
    (evaluationType === 'stamp' && !!stamp);

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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? HEADER_HEIGHT : 0}>
      <View style={styles.container}>
        <AppHeader
          showBack={true}
          showChildSwitcher={false}
          showSettings={false}
          showEdit={!editMode}
          showDelete={!editMode}
          onEdit={() => setEditMode(true)}
          onDelete={confirmDelete}
        />

        {editMode ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={{ paddingTop: HEADER_HEIGHT, paddingBottom: 320 }}
                keyboardShouldPersistTaps="handled"
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
                  {editPhotoDisplayUri ? (
                    <Image
                      source={editPhotoDisplayUri}
                      style={styles.photo}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <ActivityIndicator size="large" color="#4A90E2" />
                  )}
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
            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>子供</Text>
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

          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>教科</Text>
            {!showSubjectInput ? (
              <View style={styles.chipContainer}>
                {MAIN_SUBJECTS.map((subject) => (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.chip,
                      selectedSubject === subject && styles.chipSelected,
                    ]}
                    onPress={() => {
                      setSelectedSubject(subject);
                      setShowSubjectInput(false);
                      setNewSubject('');
                    }}
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
            ) : (
              <View style={styles.subjectInputRow}>
                <TextInput
                  style={[
                    styles.subjectInput,
                    newSubject.trim().length >= 2 && styles.textInputValid,
                  ]}
                  value={newSubject}
                  onChangeText={handleOtherSubjectChange}
                  placeholder="教科名を入力（例：生活、図工、音楽、体育）"
                  placeholderTextColor="#999"
                  autoFocus
                />
                {newSubject.trim().length >= 2 && (
                  <View style={styles.checkIconContainer}>
                    <Check size={20} color="#4CAF50" />
                  </View>
                )}
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
              <View
                ref={(el) => {
                  if (record) rowRefMap.current[record.id] = el;
                }}
                style={styles.scoreInputContainer}>
                <View style={styles.scoreInputRow}>
                  <TouchableOpacity
                    style={[
                      styles.scoreInputWrapper,
                      styles.scoreTapArea,
                      scoreError ? styles.scoreInputError : null,
                      !scoreError && score && maxScore && styles.scoreInputValid,
                    ]}
                    onPress={openScoreModal}
                    activeOpacity={0.7}>
                    <Text style={styles.scoreTapText}>{score || '—'}</Text>
                    {!scoreError && score && maxScore && (
                      <View style={styles.scoreCheckIcon}>
                        <Check size={16} color="#4CAF50" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.scoreLabel}>点</Text>
                  <Text style={styles.scoreSeparator}>/</Text>
                  <TouchableOpacity
                    style={[
                      styles.scoreTapArea,
                      styles.maxScoreTapArea,
                      scoreError ? styles.scoreInputError : null,
                      !scoreError && score && maxScore && styles.scoreInputValid,
                    ]}
                    onPress={() => {
                      setMaxScore('');
                      setShowFullScoreModal(true);
                    }}
                    activeOpacity={0.7}>
                    <Text style={styles.scoreTapText}>{maxScore || '100'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.scoreLabel}>点中</Text>
                </View>
                {scoreError ? (
                  <View style={styles.scoreErrorContainer}>
                    <Text style={styles.scoreErrorText}>{scoreError}</Text>
                  </View>
                ) : null}
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
                    onPress={() => {
                      setStamp(s);
                      setShowCustomStampInput(false);
                      setCustomStamp('');
                    }}
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

                {!showCustomStampInput ? (
                  <TouchableOpacity
                    style={[
                      styles.stampButton,
                      styles.stampButtonOther,
                      stamp && !['大変よくできました', 'よくできました', 'がんばりました'].includes(stamp) && styles.stampButtonSelected,
                    ]}
                    onPress={() => {
                      setShowCustomStampInput(true);
                      if (stamp && !['大変よくできました', 'よくできました', 'がんばりました'].includes(stamp)) {
                        setCustomStamp(stamp);
                      } else {
                        setStamp(null);
                      }
                    }}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.stampText,
                        stamp && !['大変よくできました', 'よくできました', 'がんばりました'].includes(stamp) && styles.stampTextSelected,
                      ]}>
                      {stamp && !['大変よくできました', 'よくできました', 'がんばりました'].includes(stamp) ? stamp : 'その他'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.customStampInputRow}>
                    <TextInput
                      style={[
                        styles.customStampInput,
                        customStamp.trim().length >= 2 && styles.textInputValid,
                      ]}
                      value={customStamp}
                      onChangeText={(value) => {
                        setCustomStamp(value);
                        if (value.trim().length >= 2) {
                          setStamp(value.trim());
                        }
                      }}
                      placeholder="評価を入力（例：よくがんばった、もう少し）"
                      placeholderTextColor="#999"
                      autoFocus
                    />
                    {customStamp.trim().length >= 2 && (
                      <View style={styles.checkIconContainer}>
                        <Check size={20} color="#4CAF50" />
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        setShowCustomStampInput(false);
                        setCustomStamp('');
                      }}
                      activeOpacity={0.7}>
                      <X size={24} color="#999" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.editSection}>
            <Text style={[styles.editSectionTitle, { marginBottom: 6, fontWeight: '600' }]}>メモ</Text>
            <TextInput
              style={styles.memoInput}
              value={memo}
              onChangeText={setMemo}
              placeholder="メモを入力（例：計算がんばった！）"
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              maxLength={200}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
            />
            <Text style={styles.memoCharCount}>{memo.length} / 200</Text>
          </View>

          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>日付</Text>
            <View style={styles.dateInputContainer}>
              <TextInput
                style={styles.dateInput}
                value={record?.date || ''}
                onChangeText={(value) => {
                  if (record) {
                    setRecord({ ...record, date: value });
                  }
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.calendarButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}>
                <CalendarIcon size={20} color="#4A90E2" />
              </TouchableOpacity>
            </View>
            {record?.date && (
              <Text style={styles.dateDisplayText}>{formatDisplayDate(record.date)}</Text>
            )}
          </View>

          {record && (
            <CalendarPicker
              visible={showDatePicker}
              selectedDate={record.date}
              onDateSelect={(date) => setRecord({ ...record, date })}
              onClose={() => setShowDatePicker(false)}
              maxDate={new Date()}
            />
          )}

          <View style={{ height: 100 }} />
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingTop: HEADER_HEIGHT }}
          showsVerticalScrollIndicator={false}>
          {recordPhotoDisplayUri && (
            <TouchableOpacity
              onPress={() => setShowImageModal(true)}
              activeOpacity={0.9}
              style={styles.imageContainer}>
              <View style={styles.imageWrapper}>
                <Image
                  source={recordPhotoDisplayUri}
                  style={styles.image}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.content}>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={[styles.subjectChipCompact, { backgroundColor: getSubjectColor(record.subject) }]}>
                  <Text style={styles.subjectChipTextCompact}>{record.subject}</Text>
                </View>

                {record.score !== null ? (
                  <Text style={styles.scoreDisplayCompact}>
                    {record.score}点({record.max_score}点中)
                  </Text>
                ) : (
                  <Text style={styles.stampDisplayCompact}>{record.stamp}</Text>
                )}

                <Text style={styles.dateDisplayCompact}>{formatDate(record.date)}</Text>
              </View>
            </View>

            {record.memo && (
              <View style={styles.memoSection}>
                <Text style={styles.memoLabel}>メモ</Text>
                <Text style={styles.memoText}>{record.memo}</Text>
              </View>
            )}

            <View style={{ height: 100 }} />
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
              style={[
                styles.saveButton,
                (isSaving || !canSaveInEdit) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={isSaving || !canSaveInEdit}
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
              onPress={() => router.push('/(tabs)')}
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
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowImageModal(false)}
              activeOpacity={0.7}>
              <X size={28} color="#fff" />
            </TouchableOpacity>
          {recordPhotoDisplayUri && (
              <View style={styles.modalImageWrapper}>
                <PanGestureHandler
                  ref={panRef}
                  simultaneousHandlers={pinchRef}
                  minPointers={1}
                  onGestureEvent={onPanEvent}
                  onHandlerStateChange={onPanStateChange}>
                  <Animated.View style={styles.pinchWrapper}>
                    <PinchGestureHandler
                      ref={pinchRef}
                      simultaneousHandlers={panRef}
                      minPointers={2}
                      maxPointers={2}
                      onGestureEvent={onPinchEvent}
                      onHandlerStateChange={onPinchStateChange}>
                      <Animated.View
                        style={[
                          styles.pinchContent,
                          {
                            transform: [
                              { translateX: Animated.add(baseTranslateX, translateX) },
                              { translateY: Animated.add(baseTranslateY, translateY) },
                              { scale: Animated.multiply(baseScale, pinchScale) },
                            ],
                          },
                        ]}>
                        <Image
                          source={recordPhotoDisplayUri}
                          style={styles.modalImage}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                        />
                      </Animated.View>
                    </PinchGestureHandler>
                  </Animated.View>
                </PanGestureHandler>
              </View>
            )}
          </View>
        </GestureHandlerRootView>
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

      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={handleCameraCancel}>
        {cameraPhase === 'preview' && previewUri ? (
          <CameraPreviewScreen
            imageUri={previewUri}
            onRetake={handlePreviewRetake}
            onSave={handlePreviewSave}
          />
        ) : (
          <CameraScreen
            onCapture={handleCameraCapture}
            onCancel={handleCameraCancel}
          />
        )}
      </Modal>

      {record && evaluationType === 'score' && (
        <>
          <ScoreEditorModal
            visible={showScoreModal}
            initialValue={
              record.score ??
              (score.trim() && Number.isFinite(parseInt(score, 10)) ? parseInt(score, 10) : null)
            }
            fullScore={parseInt(maxScore, 10) || record.max_score || 100}
            onClose={() => setShowScoreModal(false)}
            onConfirm={handleScoreModalConfirm}
          />
          <FullScoreEditorModal
            visible={showFullScoreModal}
            currentScore={
              record.score ??
              (score.trim() && Number.isFinite(parseInt(score, 10)) ? parseInt(score, 10) : null)
            }
            initialValue={maxScore.trim() ? parseInt(maxScore, 10) || null : null}
            onClose={() => setShowFullScoreModal(false)}
            onConfirm={(value) => {
              setMaxScore(String(value));
              validateScore(score, String(value));
              setShowFullScoreModal(false);
            }}
          />
        </>
      )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  subjectChipLarge: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    marginBottom: 12,
  },
  subjectChipTextLarge: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
  subjectChipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  subjectChipTextCompact: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
  },
  scoreDisplay: {
    fontSize: 24,
    color: '#333',
    fontFamily: 'Nunito-Bold',
    marginBottom: 10,
  },
  scoreDisplayCompact: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Nunito-Bold',
  },
  stampDisplay: {
    fontSize: 20,
    color: '#333',
    fontFamily: 'Nunito-Bold',
    marginBottom: 10,
  },
  stampDisplayCompact: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Nunito-Bold',
  },
  dateDisplay: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Nunito-Regular',
  },
  dateDisplayCompact: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Nunito-Regular',
  },
  memoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  memoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontFamily: 'Nunito-Bold',
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
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#4A90E2',
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipAdd: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#4A90E2',
    backgroundColor: '#fff',
  },
  chipAddText: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#4A90E2',
  },
  subjectInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
    backgroundColor: '#fff',
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
  scoreInputWrapper: {
    position: 'relative',
  },
  scoreTapArea: {
    width: 80,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  scoreTapText: {
    fontSize: 16,
    color: '#333',
  },
  maxScoreTapArea: {
    width: 60,
    alignItems: 'center',
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
  scoreInputError: {
    borderColor: '#E74C3C',
    borderWidth: 2,
    backgroundColor: '#FFEBEE',
  },
  scoreInputValid: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#F1F8F4',
  },
  scoreCheckIcon: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -8 }],
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
  scoreErrorContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  scoreErrorText: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#E74C3C',
    textAlign: 'center',
  },
  scoreInfoContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  scoreInfoText: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#4CAF50',
    textAlign: 'center',
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
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  stampButtonOther: {
    borderStyle: 'dashed',
  },
  stampText: {
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  stampTextSelected: {
    color: '#fff',
  },
  customStampInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customStampInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
    backgroundColor: '#fff',
  },
  textInputValid: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#F1F8F4',
  },
  checkIconContainer: {
    marginLeft: -36,
    marginRight: 8,
  },
  memoInput: {
    minHeight: 100,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#222',
  },
  memoCharCount: {
    textAlign: 'right',
    color: '#888',
    marginTop: 4,
    fontSize: 12,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
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
  calendarButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A90E2',
    backgroundColor: '#F0F8FF',
  },
  dateDisplayText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#4A90E2',
    textAlign: 'center',
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
  pinchWrapper: {
    width: '100%',
    height: '100%',
  },
  pinchContent: {
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
    color: '#333',
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
  saveButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.6,
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
    color: '#333',
  },
});
