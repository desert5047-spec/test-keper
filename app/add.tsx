import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  ActionSheetIOS,
  AppState,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera, RotateCw, RotateCcw, X, Calendar as CalendarIcon, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarPicker } from '@/components/CalendarPicker';
import { CameraScreen } from '@/components/CameraScreen';
import { ScoreEditorModal } from '@/components/ScoreEditorModal';
import { FullScoreEditorModal } from '@/components/FullScoreEditorModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { RecordType, StampType } from '@/types/database';
import { validateImageUri, isValidImageUri } from '@/utils/imageGuard';
import { useChild } from '@/contexts/ChildContext';
import { uploadImage, normalizePhotoUriForDb } from '@/utils/imageUpload';
import { log, warn, error as logError } from '@/lib/logger';

// Androidでexpo-cameraを使用するため、このキーは使用されませんが、エラー回避のため定義
const PENDING_CAMERA_RESULT_KEY = '@pending_camera_result';

const MAIN_SUBJECTS = ['国語', '算数', '理科', '社会', '英語'];
const LAST_SUBJECT_KEY = '@last_record_subject';
const LAST_CHILD_KEY = '@last_record_child_id';

const NETWORK_ERROR_USER_MESSAGE =
  'インターネットに接続できません。通信環境をご確認のうえ、再度お試しください。';

function isNetworkError(err: unknown): boolean {
  if (err == null) return false;
  const msg = typeof (err as { message?: string }).message === 'string' ? (err as { message: string }).message : '';
  const str = String(err);
  const name = (err as { name?: string }).name;
  const status = (err as { status?: number }).status;
  return (
    msg.includes('Network request failed') ||
    str.includes('Network request failed') ||
    name === 'TypeError' ||
    status === 0
  );
}

interface Child {
  id: string;
  name: string | null;
  color: string;
}

export default function AddScreen() {
  const debugLog = log;
  const router = useRouter();
  const { user, familyId, isFamilyReady } = useAuth();
  const { selectedChildId: contextSelectedChildId, children: contextChildren } = useChild();
  const scrollViewRef = useRef<ScrollView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('国語');
  const [newSubject, setNewSubject] = useState<string>('');
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const [type, setType] = useState<RecordType>('テスト');
  const [evaluationType, setEvaluationType] = useState<'score' | 'stamp'>('score');
  const [score, setScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('100');
  const [stamp, setStamp] = useState<string | null>(null);
  const [customStamp, setCustomStamp] = useState<string>('');
  const [showCustomStampInput, setShowCustomStampInput] = useState(false);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(contextSelectedChildId);
  const [scoreError, setScoreError] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showFullScoreModal, setShowFullScoreModal] = useState(false);
  const [photoRotation, setPhotoRotation] = useState<number>(0);
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    const loadLastSelections = async () => {
      try {
        const results = await AsyncStorage.multiGet([LAST_SUBJECT_KEY, LAST_CHILD_KEY]);
        const lastSubject = results.find(([key]) => key === LAST_SUBJECT_KEY)?.[1] ?? '';
        const lastChildId = results.find(([key]) => key === LAST_CHILD_KEY)?.[1] ?? '';

        if (lastSubject) {
          setSelectedSubject(lastSubject);
        }
        if (lastChildId && contextChildren.some((child) => child.id === lastChildId)) {
          setSelectedChildId(lastChildId);
        }
      } catch (error) {
      warn('[記録保存] 前回選択の読み込み失敗');
      }
    };
    loadLastSelections();
  }, [contextChildren]);

  useEffect(() => {
    if (contextSelectedChildId) {
      setSelectedChildId(contextSelectedChildId);
    }
  }, [contextSelectedChildId]);

  // Androidでexpo-cameraを使用するため、この処理は不要になりました
  // ただし、エラー回避のため、コードは残しています（実行されません）
  useEffect(() => {
    // Androidではexpo-cameraを使用するため、この処理はスキップ
    // このuseEffectは実行されません（早期リターン）
    return;
    
    // 以下のコードは実行されません（expo-image-picker用の古いコード）
    if (Platform.OS !== 'android') return;

    let isProcessing = false;

    const processPendingResult = async () => {
      if (isProcessing) {
        debugLog('[写真撮影] 既に処理中', { platform: Platform.OS });
        return;
      }

      isProcessing = true;
      try {
      debugLog('[写真撮影] 保留中の結果をチェック...', { platform: Platform.OS });
        
        // まずAsyncStorageからチェック
        try {
          // すべてのキーを確認（デバッグ用）
          const allKeys = await AsyncStorage.getAllKeys();
          const pendingKeys = allKeys.filter(key => key.includes('pending') || key.includes('camera'));
          debugLog('[写真撮影] AsyncStorage全キー確認:', { 
            allKeysCount: allKeys.length,
            pendingKeys,
            platform: Platform.OS 
          });
          
          const savedData = await AsyncStorage.getItem(PENDING_CAMERA_RESULT_KEY);
          debugLog('[写真撮影] AsyncStorageチェック:', { 
            hasData: !!savedData,
            dataLength: savedData?.length || 0,
            platform: Platform.OS 
          });
          
          if (savedData && savedData !== 'waiting') {
            // 'waiting'以外の場合はURIとして扱う
            debugLog('[写真撮影] AsyncStorageからURIを取得', { platform: Platform.OS });
            
            try {
              validateImageUri(savedData);
              if (isValidImageUri(savedData)) {
                setPhotoUri(savedData);
                setPhotoRotation(0);
                // 使用したら削除
                await AsyncStorage.removeItem(PENDING_CAMERA_RESULT_KEY);
                debugLog('[写真撮影] AsyncStorageからURIを設定完了', { platform: Platform.OS });
                isProcessing = false;
                return;
              }
            } catch (validateError: any) {
              logError('[写真撮影] AsyncStorage URI検証エラー');
              await AsyncStorage.removeItem(PENDING_CAMERA_RESULT_KEY);
            }
          } else if (savedData === 'waiting') {
            // 'waiting'フラグがある場合は、getPendingResultAsyncを試す
            debugLog('[写真撮影] カメラ起動フラグを検出、getPendingResultAsyncを試行', { platform: Platform.OS });
            
            // 少し遅延を入れて、アプリが完全に復帰するのを待つ
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            try {
              const result = await ImagePicker.getPendingResultAsync();
              const hasCanceledFlag = !!result && typeof result === 'object' && 'canceled' in result;
              const canceled = hasCanceledFlag ? (result as ImagePicker.ImagePickerResult).canceled : null;
              const assets = hasCanceledFlag ? (result as ImagePicker.ImagePickerResult).assets : null;

              debugLog('[写真撮影] getPendingResultAsync結果:', { 
                hasResult: !!result,
                canceled,
                assetsCount: assets?.length || 0,
                platform: Platform.OS 
              });
              
              if (hasCanceledFlag && !canceled && assets && assets.length > 0) {
                const uri = assets[0].uri;
                if (uri && typeof uri === 'string') {
                  debugLog('[写真撮影] getPendingResultAsyncからURIを処理', { platform: Platform.OS });
                  
                  try {
                    validateImageUri(uri);
                    if (isValidImageUri(uri)) {
                      setPhotoUri(uri);
                      setPhotoRotation(0);
                      // フラグを削除
                      await AsyncStorage.removeItem(PENDING_CAMERA_RESULT_KEY);
                      debugLog('[写真撮影] getPendingResultAsyncからURIを設定完了', { platform: Platform.OS });
                      isProcessing = false;
                      return;
                    }
                  } catch (validateError: any) {
                    logError('[写真撮影] getPendingResultAsync URI検証エラー');
                    await AsyncStorage.removeItem(PENDING_CAMERA_RESULT_KEY);
                  }
                }
              } else {
                // 結果が取得できなかった場合、フラグを削除
                debugLog('[写真撮影] getPendingResultAsyncで結果なし、フラグを削除', { platform: Platform.OS });
                await AsyncStorage.removeItem(PENDING_CAMERA_RESULT_KEY);
              }
            } catch (pendingError: any) {
              logError('[写真撮影] getPendingResultAsyncエラー');
              // エラーが発生した場合もフラグを削除
              try {
                await AsyncStorage.removeItem(PENDING_CAMERA_RESULT_KEY);
              } catch (removeError) {
                logError('[写真撮影] フラグ削除エラー');
              }
            }
          }
        } catch (storageError: any) {
          logError('[写真撮影] AsyncStorage読み込みエラー');
        }
      } catch (error: any) {
        logError('[写真撮影] 保留中の結果処理エラー');
      } finally {
        isProcessing = false;
      }
    };

    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active') {
        debugLog('[写真撮影] アプリがアクティブになりました', { platform: Platform.OS });
        await processPendingResult();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // コンポーネントマウント時にもチェック（複数回チェック）
    // アプリが再起動した直後は、AsyncStorageの読み込みに時間がかかる可能性があるため、より長い間隔でチェック
    const checkIntervals = [500, 1000, 2000, 3000, 5000, 7000, 10000];
    checkIntervals.forEach((delay) => {
      setTimeout(() => {
        processPendingResult();
      }, delay);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
    try {
      setShowPhotoOptions(false);
    } catch (setStateError) {
      logError('[画像選択] setStateエラー');
    }

    try {
      debugLog('[画像選択] 画像ライブラリを起動中...', { platform: Platform.OS });
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1.0,
      });

      debugLog('[画像選択] ライブラリ結果:', { 
        canceled: result.canceled,
        assetsCount: result.assets?.length || 0,
        platform: Platform.OS 
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        
        if (!uri || typeof uri !== 'string') {
          logError('[画像選択] URIが無効');
          throw new Error('画像のURIが取得できませんでした');
        }

        debugLog('[画像選択] URI取得', { platform: Platform.OS });

        try {
          validateImageUri(uri);
        } catch (validateError: any) {
          logError('[画像選択] URI検証エラー');
          throw new Error(`画像のURI検証に失敗しました: ${validateError.message || '不明なエラー'}`);
        }

        if (!isValidImageUri(uri)) {
          logError('[画像選択] 無効なURI');
          throw new Error('画像の形式が正しくありません');
        }

        debugLog('[画像選択] 画像URIを設定中...', { platform: Platform.OS });
        
        try {
          setPhotoUri(uri);
          setPhotoRotation(0);
          debugLog('[画像選択] 画像URI設定完了', { platform: Platform.OS });
        } catch (setUriError: any) {
          logError('[画像選択] URI設定エラー');
          throw new Error(`画像の設定に失敗しました: ${setUriError.message || '不明なエラー'}`);
        }
      } else {
        debugLog('[画像選択] キャンセルされました', { platform: Platform.OS });
      }
    } catch (error: any) {
      logError('[画像選択] エラー');
      
      // エラーメッセージを表示（アプリをクラッシュさせない）
      setTimeout(() => {
        try {
          Alert.alert(
            'エラー',
            error?.message || '画像の読み込みに失敗しました。もう一度お試しください。',
            [{ text: 'OK', onPress: () => {} }],
            { cancelable: true }
          );
        } catch (alertError: any) {
          logError('[画像選択] Alert表示エラー');
          // Alert.alertも失敗した場合は、コンソールに出力するだけ
        }
      }, 100);
    }
  };

  const takePhoto = async () => {
    try {
      setShowPhotoOptions(false);
    } catch (setStateError) {
      logError('[写真撮影] setStateエラー');
    }

    // Androidではexpo-cameraを使用（Expo Goで再起動する問題を回避）
    if (Platform.OS === 'android') {
      debugLog('[写真撮影] Android: expo-cameraを使用', { platform: Platform.OS });
      setShowCamera(true);
      return;
    }

    // iOSでは従来のImagePickerを使用
    try {
      debugLog('[写真撮影] iOS: ImagePickerを使用', { platform: Platform.OS });
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1.0,
        allowsMultipleSelection: false,
      });

      debugLog('[写真撮影] カメラ結果:', { 
        canceled: result.canceled,
        assetsCount: result.assets?.length || 0,
        platform: Platform.OS 
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        
        if (!uri || typeof uri !== 'string') {
          logError('[写真撮影] URIが無効');
          throw new Error('画像のURIが取得できませんでした');
        }

        debugLog('[写真撮影] URI取得', { platform: Platform.OS });

        try {
          validateImageUri(uri);
        } catch (validateError: any) {
          logError('[写真撮影] URI検証エラー');
          throw new Error(`画像のURI検証に失敗しました: ${validateError.message || '不明なエラー'}`);
        }

        if (!isValidImageUri(uri)) {
          logError('[写真撮影] 無効なURI');
          throw new Error('画像の形式が正しくありません');
        }

        debugLog('[写真撮影] 画像URIを設定中...', { platform: Platform.OS });
        
        try {
          setPhotoUri(uri);
          setPhotoRotation(0);
          debugLog('[写真撮影] 画像URI設定完了', { platform: Platform.OS });
        } catch (setUriError: any) {
          logError('[写真撮影] URI設定エラー');
          throw new Error(`画像の設定に失敗しました: ${setUriError.message || '不明なエラー'}`);
        }
      } else {
        debugLog('[写真撮影] キャンセルされました', { platform: Platform.OS });
      }
    } catch (error: any) {
      logError('[写真撮影] エラー');
      
      // エラーメッセージを表示（アプリをクラッシュさせない）
      setTimeout(() => {
        try {
          Alert.alert(
            'エラー',
            error?.message || '画像の撮影に失敗しました。もう一度お試しください。',
            [{ text: 'OK', onPress: () => {} }],
            { cancelable: true }
          );
        } catch (alertError: any) {
          logError('[写真撮影] Alert表示エラー');
        }
      }, 100);
    }
  };

  const handleCameraCapture = async (uri: string) => {
    try {
      debugLog('[写真撮影] カメラからURIを取得', { platform: Platform.OS });
      setShowCamera(false);

      try {
        validateImageUri(uri);
      } catch (validateError: any) {
        logError('[写真撮影] URI検証エラー');
        Alert.alert('エラー', `画像のURI検証に失敗しました: ${validateError.message || '不明なエラー'}`);
        return;
      }

      if (!isValidImageUri(uri)) {
        logError('[写真撮影] 無効なURI');
        Alert.alert('エラー', '画像の形式が正しくありません');
        return;
      }

      debugLog('[写真撮影] 画像URIを設定中...', { platform: Platform.OS });
      setPhotoUri(uri);
      setPhotoRotation(0);
      debugLog('[写真撮影] 画像URI設定完了', { platform: Platform.OS });
    } catch (error: any) {
      logError('[写真撮影] カメラキャプチャ処理エラー');
      setShowCamera(false);
      Alert.alert('エラー', error?.message || '画像の処理に失敗しました');
    }
  };

  const handleCameraCancel = () => {
    debugLog('[写真撮影] カメラをキャンセル', { platform: Platform.OS });
    setShowCamera(false);
  };

  const rotatePhoto = async (direction: 'right' | 'left') => {
    if (!photoUri) return;

    setIsProcessingImage(true);
    try {
      validateImageUri(photoUri);

      const rotation = direction === 'right' ? 90 : -90;
      const newRotation = (photoRotation + rotation + 360) % 360;
      const result = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ rotate: rotation }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      validateImageUri(result.uri);
      if (!isValidImageUri(result.uri)) {
        throw new Error('回転後の画像が無効です');
      }

      setPhotoUri(result.uri);
      setPhotoRotation(newRotation);
    } catch (error: any) {
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
        { text: '削除', style: 'destructive', onPress: () => {
          setPhotoUri(null);
          setPhotoRotation(0);
        }},
      ]
    );
  };

  const handleOtherSubjectChange = (value: string) => {
    setNewSubject(value);
    if (value.trim().length >= 2) {
      setSelectedSubject(value.trim());
    }
  };

  const canSave = () => {
    if (!selectedSubject) return false;
    const hasMethodInput =
      evaluationType === 'score' ? !!score.trim() : !!stamp;
    if (!photoUri && !hasMethodInput) return false;
    if (hasMethodInput && evaluationType === 'score') {
      const scoreNum = parseInt(score);
      const maxScoreNum = parseInt(maxScore);
      if (isNaN(scoreNum) || isNaN(maxScoreNum) || scoreNum < 0 || maxScoreNum <= 0) {
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (isSaving) return;

    try {
      if (!selectedSubject) {
        setErrorMessage('教科を選んでください');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }

      const hasMethodInput =
        evaluationType === 'score' ? !!score.trim() : !!stamp;
      if (!photoUri && !hasMethodInput) {
        setErrorMessage('写真または記録方法を入力してください');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }
      if (hasMethodInput) {
        if (evaluationType === 'score') {
          const scoreNum = parseInt(score);
          const maxScoreNum = parseInt(maxScore);
          if (isNaN(scoreNum) || isNaN(maxScoreNum) || scoreNum < 0 || maxScoreNum <= 0) {
            setErrorMessage('点数は正しい数字で入れてください');
            setTimeout(() => setErrorMessage(''), 3000);
            return;
          }
          if (scoreNum > maxScoreNum) {
            setErrorMessage(`点数は${maxScoreNum}点以下で入力してください`);
            setTimeout(() => setErrorMessage(''), 3000);
            return;
          }
        } else if (!stamp) {
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
          logError('[記録保存] 画像URI検証エラー');
          setErrorMessage(error?.message || '画像の形式が正しくありません');
          setTimeout(() => setErrorMessage(''), 3000);
          return;
        }
      }

      if (!user) {
        try {
          Alert.alert('エラー', 'ログインが必要です');
        } catch (alertError) {
          logError('[記録保存] Alert表示エラー');
          setErrorMessage('ログインが必要です');
        }
        return;
      }
      if (!isFamilyReady || !familyId) {
        setErrorMessage('家族情報の取得中です。少し待ってから再度お試しください');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }

      // child_idの妥当性チェック
      if (selectedChildId) {
        // selectedChildIdがcontextChildrenに存在するか確認
        const childExists = contextChildren.some(child => child.id === selectedChildId);
        if (!childExists) {
          try {
            Alert.alert('エラー', '選択された子供が見つかりません。ページを再読み込みしてください。');
          } catch (alertError) {
            logError('[記録保存] Alert表示エラー');
            setErrorMessage('選択された子供が見つかりません');
          }
          return;
        }
      } else if (contextChildren.length > 0) {
        // 子供が登録されているのにselectedChildIdがnullの場合
        try {
          Alert.alert('エラー', '子供を選択してください');
        } catch (alertError) {
          logError('[記録保存] Alert表示エラー');
          setErrorMessage('子供を選択してください');
        }
        return;
      }

      setIsSaving(true);
      setErrorMessage(''); // エラーメッセージをクリア

      try {
      const hasMethodInputFinal =
        evaluationType === 'score' ? !!score.trim() : !!stamp;
      const scoreValue = hasMethodInputFinal && evaluationType === 'score'
        ? parseInt(score)
        : null;
      const maxScoreValue = hasMethodInputFinal && evaluationType === 'score'
        ? parseInt(maxScore)
        : 100;
      const stampValue = hasMethodInputFinal && evaluationType === 'stamp'
        ? stamp
        : null;

      debugLog('[記録保存] データベースに保存開始');

      try {
        const { data: insertData, error } = await supabase
          .from('records')
          .insert({
            child_id: selectedChildId || null,
            family_id: familyId,
            date,
            subject: selectedSubject,
            type,
            score: scoreValue,
            max_score: maxScoreValue,
            stamp: stampValue,
            memo: memo.trim() || null,
            photo_uri: null,
            photo_rotation: photoRotation,
            user_id: user.id,
          })
          .select('id')
          .single();

        if (error) {
          logError('[記録保存] データベース保存エラー');
          throw new Error(`データベースへの保存に失敗しました: ${error.message || '不明なエラー'}`);
        }

        const recordId = insertData?.id;
        if (!recordId) {
          throw new Error('記録のIDを取得できませんでした');
        }

        if (photoUri) {
          let path: string | null = null;
          try {
            debugLog('[記録保存] 画像アップロード開始', { recordId });
            const uploadPromise = uploadImage(photoUri, recordId);
            const timeoutPromise = new Promise<string>((_, reject) => {
              setTimeout(() => reject(new Error('画像のアップロードがタイムアウトしました（60秒）')), 60000);
            });
            path = await Promise.race([uploadPromise, timeoutPromise]);
          } catch (uploadError: any) {
            logError('[記録保存] 画像アップロードエラー');
            const { error: deleteError } = await supabase.from('records').delete().eq('id', recordId);
            if (deleteError) logError('[記録保存] ロールバック用レコード削除エラー', deleteError);
            throw uploadError;
          }
          if (!path || !path.trim()) {
            const { error: deleteError } = await supabase.from('records').delete().eq('id', recordId);
            if (deleteError) logError('[記録保存] ロールバック用レコード削除エラー', deleteError);
            throw new Error('画像のアップロードに失敗しました（pathが取得できませんでした）');
          }
          log('[SAVE][add] upload result path:', path);
          const { error: updateError } = await supabase
            .from('records')
            .update({ photo_uri: path })
            .eq('id', recordId);
          if (updateError) {
            logError('[記録保存] photo_uri 更新エラー');
            const { error: deleteError } = await supabase.from('records').delete().eq('id', recordId);
            if (deleteError) logError('[記録保存] ロールバック用レコード削除エラー', deleteError);
            throw new Error(`写真の保存に失敗しました: ${updateError.message}`);
          }
        }

        log('[SAVE][add] photo_uri to DB: path は upload 時のみ設定済み');
        debugLog('[記録保存] データベース保存成功');

        try {
          await AsyncStorage.setItem(LAST_SUBJECT_KEY, selectedSubject);
          if (selectedChildId) {
            await AsyncStorage.setItem(LAST_CHILD_KEY, selectedChildId);
          } else {
            await AsyncStorage.removeItem(LAST_CHILD_KEY);
          }
        } catch (persistError) {
          warn('[記録保存] 前回選択の保存失敗');
        }

        // 成功時の処理もtry-catchで保護（描画完了後にモーダル表示で遷移を確実に）
        try {
          setIsSaving(false);
          setShowToast(true);
          InteractionManager.runAfterInteractions(() => {
            setShowSaveConfirm(true);
          });
          setTimeout(() => setShowToast(false), 300);
        } catch (successError: any) {
          logError('[記録保存] 成功処理エラー');
          // 成功処理に失敗しても、保存は完了しているので、エラーを表示しない
        }
      } catch (dbError: any) {
        logError('[記録保存] データベース保存エラー');
        throw dbError;
      }
    } catch (error: any) {
      logError('[記録保存] 予期しないエラー', error);

      const isNetwork = isNetworkError(error);
      const userMessage = isNetwork ? NETWORK_ERROR_USER_MESSAGE : (error?.message || error?.toString() || '保存に失敗しました');
      setErrorMessage(userMessage);
      setTimeout(() => setErrorMessage(''), 8000);

      setTimeout(() => {
        try {
          if (isNetwork) {
            Alert.alert(
              '通信エラー',
              NETWORK_ERROR_USER_MESSAGE,
              [
                { text: 'キャンセル', style: 'cancel' as const },
                { text: '再試行', onPress: () => handleSave() },
              ],
              { cancelable: true }
            );
          } else {
            Alert.alert(
              'エラー',
              userMessage,
              [{ text: 'OK', onPress: () => {} }],
              { cancelable: true }
            );
          }
        } catch (alertError: any) {
          logError('[記録保存] Alert表示エラー');
        }
      }, 100);
    } finally {
      // 必ず実行されるようにする
      try {
        setIsSaving(false);
      } catch (setStateError: any) {
        logError('[記録保存] setStateエラー');
      }
    }
    } catch (_) {
      // 最外側 try (589) 用の catch（内側で既に処理済みのため何もしない）
    }
  };

  const resetForm = () => {
    setPhotoUri(null);
    setPhotoRotation(0);
    setScore('');
    setMaxScore('100');
    setStamp(null);
    setCustomStamp('');
    setShowCustomStampInput(false);
    setMemo('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const saveConfirmMessage =
    photoUploadFailed
      ? '記録は保存されましたが、写真のアップロードに失敗しました。続けて入力しますか？'
      : '記録は保存されました。続けて入力しますか？';

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

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
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
                  source={photoUri}
                  style={styles.photo}
                  contentFit="contain"
                  cachePolicy="memory-disk"
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

        {contextChildren.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {`${contextChildren.find(c => c.id === selectedChildId)?.name || '子供'}の記録`}
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
        ) : null}

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
                style={[
                  styles.textInput,
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
              onPress={() => {
                setEvaluationType('stamp');
                setScoreError('');
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
            <>
              <View style={styles.scoreInputContainer}>
                <View style={styles.scoreInputRow}>
                  <TouchableOpacity
                    style={[
                      styles.scoreInputWrapper,
                      styles.scoreTapArea,
                      scoreError ? styles.scoreInputError : null,
                      !scoreError && score.trim() !== '' && maxScore.trim() !== '' ? styles.scoreInputValid : null,
                    ]}
                    onPress={() => setShowScoreModal(true)}
                    activeOpacity={0.7}>
                    <Text style={styles.scoreTapText}>{score || '—'}</Text>
                    {!scoreError && score.trim() !== '' && maxScore.trim() !== '' ? (
                      <View style={styles.scoreCheckIcon}>
                        <Check size={16} color="#4CAF50" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                <Text style={styles.scoreLabel}>点</Text>
                <Text style={styles.scoreSeparator}>{'/'}</Text>
                <TouchableOpacity
                  style={[
                    styles.scoreTapArea,
                    styles.maxScoreTapArea,
                    scoreError ? styles.scoreInputError : null,
                    !scoreError && score.trim() !== '' && maxScore.trim() !== '' ? styles.scoreInputValid : null,
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
                    <Text style={styles.scoreErrorText}>{String(scoreError)}</Text>
                  </View>
                ) : null}
              </View>
              <ScoreEditorModal
                visible={showScoreModal}
                initialValue={
                  score.trim() && Number.isFinite(parseInt(score, 10)) ? parseInt(score, 10) : null
                }
                fullScore={parseInt(maxScore, 10) || 100}
                onClose={() => setShowScoreModal(false)}
                onConfirm={(value) => {
                  setScore(value != null ? String(value) : '');
                  setScoreError('');
                }}
              />
              <FullScoreEditorModal
                visible={showFullScoreModal}
                currentScore={
                  score.trim() && Number.isFinite(parseInt(score, 10)) ? parseInt(score, 10) : null
                }
                initialValue={maxScore.trim() ? parseInt(maxScore, 10) || null : null}
                onClose={() => setShowFullScoreModal(false)}
                onConfirm={(value) => {
                  setMaxScore(String(value));
                  validateScore(score, String(value));
                }}
              />
            </>
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
                    setStamp(null);
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>日付</Text>
          <View style={styles.dateInputContainer}>
            <TextInput
              style={styles.dateInput}
              value={date}
              onChangeText={setDate}
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
          {date && date.trim() !== '' ? (
            <Text style={styles.dateDisplayText}>{formatDisplayDate(date)}</Text>
          ) : null}
        </View>

        <CalendarPicker
          visible={showDatePicker}
          selectedDate={date}
          onDateSelect={setDate}
          onClose={() => setShowDatePicker(false)}
          maxDate={new Date()}
        />

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
          style={[
            styles.bottomSaveButton,
            (isSaving || (evaluationType === 'score' && scoreError)) && styles.bottomSaveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving || (evaluationType === 'score' && !!scoreError)}
          activeOpacity={0.7}>
          {isSaving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={[styles.bottomSaveButtonText, { marginLeft: 8 }]}>保存中...</Text>
            </View>
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

      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={handleCameraCancel}>
        <CameraScreen
          onCapture={handleCameraCapture}
          onCancel={handleCameraCancel}
        />
      </Modal>

      {showToast && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>記録を残しました</Text>
        </View>
      )}

      <Modal
        visible={showSaveConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { setShowSaveConfirm(false); setPhotoUploadFailed(false); }}>
        <View style={styles.saveConfirmOverlay}>
          <View style={styles.saveConfirmCard}>
            <Text style={styles.saveConfirmTitle}>確認</Text>
            <Text style={styles.saveConfirmMessage}>{saveConfirmMessage}</Text>
            <View style={styles.saveConfirmActions}>
              <TouchableOpacity
                style={styles.saveConfirmSecondaryButton}
                onPress={() => {
                  setShowSaveConfirm(false);
                  setPhotoUploadFailed(false);
                  resetForm();
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                  }, 0);
                }}
                activeOpacity={0.7}>
                <Text style={styles.saveConfirmSecondaryText}>続けて記録する</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveConfirmPrimaryButton}
                onPress={() => {
                  setShowSaveConfirm(false);
                  setPhotoUploadFailed(false);
                  resetForm();
                  router.push('/(tabs)');
                }}
                activeOpacity={0.7}>
                <Text style={styles.saveConfirmPrimaryText}>ホームに戻る</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  textInputValid: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#F1F8F4',
  },
  checkIconContainer: {
    marginLeft: -36,
    marginRight: 8,
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
    ...Platform.select({
      web: {
        boxShadow: '0px -2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 10,
      },
    }),
  },
  bottomSaveButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    zIndex: 1001,
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
  saveConfirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  saveConfirmCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  saveConfirmTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  saveConfirmMessage: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  saveConfirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveConfirmSecondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#666',
  },
  saveConfirmSecondaryText: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#666',
  },
  saveConfirmPrimaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#666',
  },
  saveConfirmPrimaryText: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#666',
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
