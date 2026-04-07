import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  ActionSheetIOS,
  Animated,
  findNodeHandle,
  UIManager,
  StatusBar,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { X, Camera, Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { DateField, isValidYmd } from '@/components/DateField';
import { CameraScreen } from '@/components/CameraScreen';
import { CameraPreviewScreen } from '@/components/CameraPreviewScreen';
import { ScoreEditorModal } from '@/components/ScoreEditorModal';
import { FullScoreEditorModal } from '@/components/FullScoreEditorModal';
import { CommentComposer } from '@/components/CommentComposer';
import { supabase } from '@/lib/supabase';
import type { TestRecord, RecordType, StampType } from '@/types/database';
import { validateImageUri, isValidImageUri } from '@/utils/imageGuard';
import { AppHeader, HEADER_HEIGHT, useHeaderTop } from '@/components/AppHeader';
import { uploadImage, deleteImage, getStoragePathFromUrl, normalizePhotoUriForDb } from '@/utils/imageUpload';
import { resolveImageUrl } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { log, error as logError } from '@/lib/logger';
import { useChild } from '@/contexts/ChildContext';
import { getSubjectColor, getSubjectsForLevel, type SchoolLevel } from '@/lib/subjects';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const headerTop = useHeaderTop();
  const { user, familyId, isFamilyReady } = useAuth();
  const { children: contextChildren } = useChild();
  const [record, setRecord] = useState<TestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSwitchingChild, setIsSwitchingChild] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPhase, setCameraPhase] = useState<'camera' | 'preview'>('camera');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [scoreError, setScoreError] = useState<string>('');
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
  const scrollRef = useRef<ScrollView>(null);
  const isAndroid = Platform.OS === 'android';
  const footerH = 72;
  const bottomPad = (isAndroid ? footerH : 0) + Math.max(insets.bottom, 12) + 16;
  const rootLayoutRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const scrollContentAnchorRef = useRef<View>(null);
  const rowRefMap = useRef<Record<string, View | null>>({});
  const [stamp, setStamp] = useState<string | null>(null);
  const [memo, setMemo] = useState<string>('');
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [newSubject, setNewSubject] = useState<string>('');
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const [showOtherSubjects, setShowOtherSubjects] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const allowNavigationRef = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const unsavedDiscardRef = useRef<(() => void) | null>(null);
  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const navigation = useNavigation();
  const currentChild = contextChildren.find(c => c.id === selectedChildId) ?? null;
  const subjectSet = getSubjectsForLevel((currentChild?.school_level as SchoolLevel) ?? null);

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

  const goBackOrToList = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/index');
    }
  };

  const handleCancel = () => {
    if (editMode && isDirty) {
      showUnsavedAlert(() => {
        allowNavigationRef.current = true;
        setIsDirty(false);
        if (record) initializeEditForm(record);
        goBackOrToList();
      });
    } else {
      goBackOrToList();
    }
  };

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
    resolveImageUrl(photoUri).then((resolved) => {
      if (!cancelled && resolved) setResolvedEditPhotoUrl(resolved);
    });
    return () => { cancelled = true; };
  }, [photoUri]);

  useEffect(() => {
    if (!params.id || !isFamilyReady || !familyId) return;
    setIsSwitchingChild(true);
    setRecord(null);
    loadRecord(params.id as string).finally(() => {
      setIsSwitchingChild(false);
    });
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
      const resolved = data.photo_uri ? await resolveImageUrl(data.photo_uri) : null;
      setResolvedRecordPhotoUrl(resolved);
    }
    setLoading(false);
  };

  const initializeEditForm = (data: TestRecord) => {
    setPhotoUri(data.photo_uri ?? null);
    setEvaluationType(data.score !== null ? 'score' : 'stamp');
    setScore(data.score?.toString() || '');
    setMaxScore(data.max_score?.toString() || '100');
    setStamp(data.stamp);
    setMemo(data.memo || '');
    setScoreError('');
    setSelectedSubject(data.subject || '');
    setSelectedChildId(data.child_id || null);
    setIsDirty(false);
    const allStandard = [...subjectSet.main, ...subjectSet.other];
    if (data.subject && !allStandard.includes(data.subject)) {
      setShowSubjectInput(true);
      setNewSubject(data.subject);
    } else {
      if (data.subject && subjectSet.other.includes(data.subject)) {
        setShowOtherSubjects(true);
      }
      setShowSubjectInput(false);
      setNewSubject('');
    }
  };

  const showUnsavedAlert = (onDiscard: () => void) => {
    unsavedDiscardRef.current = onDiscard;
    setShowUnsavedModal(true);
  };

  // Stack headerShown: false のためヘッダーは自前（AppHeader）で統一
  // useLayoutEffect による headerStyle 設定は削除済み

  // [2] 実測ログ（__DEV__のみ）
  useEffect(() => {
    if (!__DEV__ || !editMode || !record) return;
    const sb = StatusBar.currentHeight ?? 'N/A';
    console.log(
      `[DETAIL][Insets] top=${insets.top} bottom=${insets.bottom}`
    );
    console.log(`[DETAIL][StatusBar] currentHeight=${sb}`);
    console.log(`[DETAIL][HeaderHeight] useHeaderHeight=${headerHeight}`);
  }, [__DEV__, editMode, record, insets.top, insets.bottom, headerHeight]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (allowNavigationRef.current) return;
      if (!editMode || !isDirty) return;

      e.preventDefault();
      showUnsavedAlert(() => {
        allowNavigationRef.current = true;
        setIsDirty(false);
        navigation.dispatch(e.data.action);
      });
    });
    return unsubscribe;
  }, [navigation, editMode, isDirty]);

  const handleOtherSubjectChange = (value: string) => {
    setNewSubject(value);
    if (value.trim().length >= 2) {
      const next = value.trim();
      if (next !== selectedSubject) {
        setSelectedSubject(next);
        setIsDirty(true);
      }
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
        if (uri !== photoUri) {
          setPhotoUri(uri);
          setIsDirty(true);
        }
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

  const handlePreviewSave = (uri: string) => {
    if (uri !== photoUri) {
      setPhotoUri(uri);
      setIsDirty(true);
    }
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



  const handleDeletePhoto = async () => {
    try {
      if (record?.photo_uri) {
        const pathToDelete = normalizePhotoUriForDb(record.photo_uri) ?? record.photo_uri;
        await deleteImage(pathToDelete);
      }
      setPhotoUri(null);
      setIsDirty(true);
    } catch (e) {
      logError('[写真削除エラー]', e);
      Alert.alert('エラー', '写真の削除に失敗しました');
    }
  };

  const confirmRemovePhoto = () => {
    Alert.alert(
      '写真を削除',
      '写真を削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: handleDeletePhoto },
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

      if (photoUri === null) {
        uploadedImagePath = null;
      } else if (photoUri && photoUri !== record.photo_uri) {
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
      log('[保存時 photoUri]', photoUri);
      log('[SAVE][detail] photo_uri to DB (path only):', photoUriToDb);

      const updatePayload: Record<string, unknown> = {
          child_id: selectedChildId ?? null,
          subject: selectedSubject,
          score: evaluationType === 'score' && score.trim() ? parseInt(score, 10) : null,
          max_score: evaluationType === 'score' && score.trim() ? parseInt(maxScore, 10) : 100,
          stamp: evaluationType === 'stamp' && stamp ? stamp : null,
          memo: memo.trim() || null,
          photo_uri: photoUriToDb,
          photo_rotation: 0,
        };
      if (record.date && isValidYmd(record.date)) {
        updatePayload.date = record.date;
      }
      const { error } = await supabase
        .from('records')
        .update(updatePayload)
        .eq('id', record.id)
        .eq('family_id', familyId ?? '');

      if (error) throw error;

      await loadRecord(record.id);
      setIsDirty(false);
      setEditMode(false);

      if (pendingActionRef.current) {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action();
      } else {
        // 編集保存後は一覧へ戻さず、更新後の詳細表示（非編集モード）に留まる
      }
    } catch (error: any) {
      pendingActionRef.current = null;
      logError('[記録更新] 保存エラー');
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };
  handleSaveRef.current = handleSave;

  const scrollToRecord = (recordId: string) => {
    const rowEl = rowRefMap.current[recordId];
    const scrollEl = scrollRef.current;
    const anchorEl = scrollContentAnchorRef.current;
    if (!rowEl || !scrollEl || !anchorEl) return;
    const rowNode = findNodeHandle(rowEl);
    const anchorNode = findNodeHandle(anchorEl);
    if (!rowNode || !anchorNode) return;
    requestAnimationFrame(() => {
      UIManager.measureLayout(
        rowNode,
        anchorNode,
        () => {},
        (_x: number, y: number) => {
          const targetY = Math.max(0, headerTop + y - 120);
          scrollEl.scrollTo({ y: targetY, animated: true });
          setTimeout(() => {
            scrollEl.scrollTo({ y: targetY, animated: true });
          }, 80);
        }
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
    const nextScore = value != null ? String(value) : '';
    if (nextScore !== score) {
      setIsDirty(true);
    }
    setScore(nextScore);
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

      router.replace('/(tabs)');
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


  const recordPhotoDisplayUri =
    resolvedRecordPhotoUrl || (record?.photo_uri && isValidImageUri(record.photo_uri) ? record.photo_uri : null);
  const editPhotoDisplayUri =
    photoUri && isValidImageUri(photoUri) ? photoUri : resolvedEditPhotoUrl;

  if (isSwitchingChild) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={[]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>読み込み中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={[]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={[]}>
        <View style={styles.container}>
          <AppHeader showBack={true} showChildSwitcher={false} />
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>記録が見つかりません</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const handleRootLayout = (e: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => {
    if (!__DEV__ || !editMode) return;
    const { x, y, width, height } = e.nativeEvent.layout;
    rootLayoutRef.current = { x, y, w: width, h: height };
    console.log(`[DETAIL][RootLayout] x=${x} y=${y} w=${width} h=${height}`);
    // 編集時: ヘッダーは Stack が描画。コンテナの y = ヘッダー下端のオフセット
    console.log(`[DETAIL][HeaderLayout] (Stack描画のため推測) y=0 h=${headerHeight}`);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <View style={styles.container} onLayout={handleRootLayout}>
        {!editMode && (
          <AppHeader
            showBack={true}
            showChildSwitcher={false}
            showSettings={false}
            showEdit={true}
            showDelete={true}
            onEdit={() => setEditMode(true)}
            onDelete={confirmDelete}
          />
        )}

        {editMode && (
          <AppHeader
            showCancel={true}
            showSave={true}
            onCancel={handleCancel}
            onSave={() => handleSaveRef.current()}
            isSaving={isSaving}
            saveDisabled={!canSaveInEdit}
          />
        )}

        {editMode ? (
          <View style={styles.editModeRoot}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}>
              <View style={{ flex: 1 }}>
            <ScrollView
              ref={scrollRef}
              style={styles.scrollView}
              contentContainerStyle={{
                paddingTop: headerTop,
                paddingBottom: isAndroid ? bottomPad : 100 + insets.bottom,
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentInsetAdjustmentBehavior="never"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios' ? false : undefined}
              showsVerticalScrollIndicator={false}>
          <View ref={scrollContentAnchorRef} collapsable={false} style={[styles.section, styles.photoSection]}>
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
            <View style={[styles.section, { marginTop: 4 }]}>
              <Text style={styles.sectionTitle}>子供</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.childChipContainer}
              >
                {contextChildren.map((child) => (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      styles.childChip,
                      selectedChildId === child.id && styles.childChipSelected,
                    ]}
                    onPress={() => {
                      if (child.id !== selectedChildId) {
                        setSelectedChildId(child.id);
                        setIsDirty(true);
                      }
                    }}
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
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>教科</Text>
            {!showSubjectInput ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipContainer}
                >
                  {subjectSet.main.map((subject) => (
                    <TouchableOpacity
                      key={subject}
                      style={[
                        styles.chip,
                        selectedSubject === subject && styles.chipSelected,
                        selectedSubject === subject && { backgroundColor: getSubjectColor(subject) },
                      ]}
                      onPress={() => {
                        if (subject !== selectedSubject) {
                          setSelectedSubject(subject);
                          setShowSubjectInput(false);
                          setNewSubject('');
                          setIsDirty(true);
                          setShowOtherSubjects(false);
                        }
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
                </ScrollView>

                {showOtherSubjects && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.chipContainer, { marginTop: 8 }]}
                  >
                    {subjectSet.other.map((subject) => (
                      <TouchableOpacity
                        key={subject}
                        style={[
                          styles.chip,
                          selectedSubject === subject && styles.chipSelected,
                          selectedSubject === subject && { backgroundColor: getSubjectColor(subject) },
                        ]}
                        onPress={() => {
                          if (subject !== selectedSubject) {
                            setSelectedSubject(subject);
                            setIsDirty(true);
                          }
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
                  </ScrollView>
                )}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.chipContainer, { marginTop: 8 }]}
                >
                  {!showOtherSubjects && subjectSet.other.length > 0 && (
                    <TouchableOpacity
                      style={styles.chipOther}
                      onPress={() => setShowOtherSubjects(true)}
                      activeOpacity={0.7}>
                      <Text style={styles.chipOtherText}>その他の教科</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.chipAdd}
                    onPress={() => setShowSubjectInput(true)}
                    activeOpacity={0.7}>
                    <Text style={styles.chipAddText}>+ 教科を追加</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            ) : (
              <View style={styles.subjectInputRow}>
                <TextInput
                  style={[
                    styles.subjectInput,
                    newSubject.trim().length >= 2 && styles.textInputValid,
                  ]}
                  value={newSubject}
                  onChangeText={handleOtherSubjectChange}
                  placeholder="教科名を入力（例：生活、図工、音楽）"
                  placeholderTextColor="#999"
                  maxLength={8}
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>評価</Text>
            <View style={styles.evaluationTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.evaluationTypeButton,
                  evaluationType === 'score' && styles.evaluationTypeButtonSelected,
                ]}
                onPress={() => {
                  if (evaluationType !== 'score') {
                    setEvaluationType('score');
                    setIsDirty(true);
                  }
                }}
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
                onPress={() => {
                  if (evaluationType !== 'stamp') {
                    setEvaluationType('stamp');
                    setIsDirty(true);
                  }
                }}
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
                      if (s !== stamp) {
                        setStamp(s);
                        setIsDirty(true);
                      }
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
              </View>
            )}
          </View>

          <View style={[styles.section, styles.tightSection]}>
            <Text style={styles.sectionTitle}>日付</Text>
            <DateField
              value={record?.date ?? ''}
              onChange={(d) => {
                if (record && isValidYmd(d)) {
                  setRecord({ ...record, date: d });
                  setIsDirty(true);
                }
              }}
              maxDate={new Date()}
              placeholder="タップして選択"
            />
          </View>

          <View style={[styles.section, styles.tightSection]}>
            <Text style={[styles.sectionTitle, { marginBottom: 6, fontWeight: '600' }]}>メモ</Text>
            {Platform.OS === 'ios' ? (
              <>
                <Pressable
                  onPress={() => setIsMemoOpen(true)}
                  style={styles.memoCard}>
                  <Text style={memo?.length ? styles.memoText : styles.memoPlaceholder}>
                    {memo?.length ? memo : 'メモを入力（例：計算がんばった！）'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <TextInput
                value={memo}
                onChangeText={(t) => {
                  setMemo(t);
                  setIsDirty(true);
                }}
                placeholder="メモを入力（例：計算がんばった！）"
                placeholderTextColor="#999"
                style={[styles.memoInput, { minHeight: 44, paddingVertical: 10, textAlignVertical: 'center' as const }]}
                maxLength={200}
                multiline={false}
                numberOfLines={1}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
                onFocus={() => {
                  if (!isAndroid) return;
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
                }}
              />
            )}
            <Text style={styles.memoCharCount}>{memo.length} / 200</Text>
          </View>

          <View style={{ height: isAndroid ? bottomPad : 16, backgroundColor: '#fff' }} />
            </ScrollView>

            {Platform.OS === 'ios' && isMemoOpen && (
              <CommentComposer
                autoFocus
                value={memo}
                onChangeText={(t) => {
                  setMemo(t);
                  setIsDirty(true);
                }}
                onSubmit={(v) => {
                  const trimmed = v.trim();
                  setMemo(trimmed);
                  if (trimmed !== memo.trim()) setIsDirty(true);
                  setIsMemoOpen(false);
                }}
                onBlur={() => setIsMemoOpen(false)}
                onClose={() => setIsMemoOpen(false)}
                placeholder="メモを入力（例：計算がんばった！）"
                maxLength={200}
              />
            )}
              </View>
            </KeyboardAvoidingView>
          </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingTop: headerTop }}
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
                <Text style={styles.memoBodyText}>{record.memo}</Text>
              </View>
            )}

            <View style={{ height: 100 }} />
          </View>
        </ScrollView>
      )}

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
        visible={showUnsavedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUnsavedModal(false)}>
        <View style={styles.unsavedOverlay}>
          <View style={styles.unsavedCard}>
            <Text style={styles.unsavedTitle}>保存されていません</Text>
            <Text style={styles.unsavedMessage}>変更を破棄してよろしいですか？</Text>
            <View style={styles.unsavedActions}>
              <TouchableOpacity
                style={[styles.unsavedActionButton, styles.unsavedSaveButton]}
                activeOpacity={0.7}
                onPress={() => {
                  setShowUnsavedModal(false);
                  pendingActionRef.current = () => {
                    allowNavigationRef.current = true;
                    setIsDirty(false);
                    setEditMode(false);
                    goBackOrToList();
                  };
                  handleSaveRef.current();
                }}>
                <Text style={[styles.unsavedActionText, styles.unsavedSaveText]}>保存</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unsavedActionButton, styles.unsavedDiscardButton]}
                activeOpacity={0.7}
                onPress={() => {
                  setShowUnsavedModal(false);
                  const onDiscard = unsavedDiscardRef.current;
                  unsavedDiscardRef.current = null;
                  onDiscard?.();
                }}>
                <Text style={[styles.unsavedActionText, styles.unsavedDiscardText]}>キャンセル(破棄)</Text>
              </TouchableOpacity>
            </View>
          </View>
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
          <View style={[styles.actionSheet, { paddingBottom: 12 + Math.max(insets.bottom, 12) }]}>
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
              const next = String(value);
              if (next !== maxScore) {
                setMaxScore(next);
                setIsDirty(true);
              }
              validateScore(score, next);
              setShowFullScoreModal(false);
            }}
          />
        </>
      )}
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  editModeRoot: {
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
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipSelected: {
    backgroundColor: '#4A90E2',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipOther: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  chipOtherText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
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
  memoBodyText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 6,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 8,
  },
  tightSection: {
    marginTop: 4,
    paddingTop: 6,
    paddingBottom: 8,
  },
  photoSection: {
    paddingTop: 0,
    marginTop: 4,
    paddingBottom: 0,
  },
  photoContainer: {
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  photoWrapper: {
    width: '100%',
    height: 280,
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
    gap: 8,
    alignItems: 'center',
    paddingRight: 8,
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
  stampText: {
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  stampTextSelected: {
    color: '#fff',
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
  memoCard: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 14,
    backgroundColor: '#FFF',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  memoText: {
    fontSize: 15,
    color: '#222',
    textAlign: 'left',
  },
  memoPlaceholder: {
    fontSize: 15,
    color: '#999',
    textAlign: 'left',
  },
  memoCharCount: {
    textAlign: 'right',
    color: '#888',
    marginTop: 4,
    fontSize: 12,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
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
  bottomSaveButtonWrap: {
    overflow: 'hidden',
  },
  bottomSaveButton: {
    backgroundColor: '#4A90E2',
    minWidth: 120,
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSaveButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.6,
  },
  bottomSaveButtonText: {
    color: '#fff',
    fontSize: 17,
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
  unsavedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  unsavedCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
  },
  unsavedTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#222',
    marginBottom: 8,
  },
  unsavedMessage: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#444',
    marginBottom: 16,
    lineHeight: 20,
  },
  unsavedActions: {
    flexDirection: 'row',
    gap: 10,
  },
  unsavedActionButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  unsavedSaveButton: {
    borderColor: '#4A90E2',
  },
  unsavedDiscardButton: {
    borderColor: '#E74C3C',
  },
  unsavedActionText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
  },
  unsavedSaveText: {
    color: '#4A90E2',
  },
  unsavedDiscardText: {
    color: '#E74C3C',
  },
});
