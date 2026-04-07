import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw, RotateCw, Check, Crop, RefreshCw } from 'lucide-react-native';
import { ImageCropEditor } from './ImageCropEditor';
import * as ImageManipulator from 'expo-image-manipulator';
import { log } from '@/lib/logger';

const ACTION_GAP = Platform.select({ android: 20, default: 16 }) as number;
const { width: SCREEN_W } = Dimensions.get('window');

const PREVIEW_W = SCREEN_W;
const PREVIEW_H = Math.round(SCREEN_W * (4 / 3));

interface CameraPreviewScreenProps {
  imageUri: string;
  physicalOrientation?: 'portrait' | 'landscape-left' | 'landscape-right';
  onRetake: () => void;
  onSave: (uri: string) => void;
}

async function normalizeCapturedImage(
  imageUri: string,
  physicalOrientation: 'portrait' | 'landscape-left' | 'landscape-right'
): Promise<string> {
  const normalized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ rotate: 0 }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );
  const normW = normalized.width;
  const normH = normalized.height;
  const isPhysicalLandscape = physicalOrientation.startsWith('landscape');

  if (isPhysicalLandscape) {
    const alreadyLandscape = normW > normH;

    if (alreadyLandscape) {
      const targetRatio = 4 / 3;
      const curRatio = normW / normH;
      const needsCrop = Number.isFinite(curRatio) && Math.abs(curRatio - targetRatio) > 0.02;
      if (!needsCrop) {
        return normalized.uri;
      }
      let cropW: number;
      let cropH: number;
      let cropX: number;
      let cropY: number;
      if (curRatio > targetRatio) {
        cropH = normH;
        cropW = Math.round(normH * targetRatio);
        cropX = Math.round((normW - cropW) / 2);
        cropY = 0;
      } else {
        cropW = normW;
        cropH = Math.round(normW / targetRatio);
        cropX = 0;
        cropY = Math.round((normH - cropH) / 2);
      }
      const result = await ImageManipulator.manipulateAsync(
        normalized.uri,
        [{ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    }

    const extraRotation = physicalOrientation === 'landscape-left' ? -90 : 90;
    const postW = normH;
    const postH = normW;
    const targetRatio = 4 / 3;
    const curRatio = postW / postH;
    const needsCrop = Number.isFinite(curRatio) && Math.abs(curRatio - targetRatio) > 0.02;
    const actions: ImageManipulator.Action[] = [{ rotate: extraRotation }];

    if (needsCrop) {
      let cropW: number;
      let cropH: number;
      let cropX: number;
      let cropY: number;
      if (curRatio > targetRatio) {
        cropH = postH;
        cropW = Math.round(postH * targetRatio);
        cropX = Math.round((postW - cropW) / 2);
        cropY = 0;
      } else {
        cropW = postW;
        cropH = Math.round(postW / targetRatio);
        cropX = 0;
        cropY = Math.round((postH - cropH) / 2);
      }
      actions.push({ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } });
    }

    const result = await ImageManipulator.manipulateAsync(
      normalized.uri,
      actions,
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  }

  const targetRatio = 3 / 4;
  const curRatio = normW / normH;
  const needsCrop = Number.isFinite(curRatio) && Math.abs(curRatio - targetRatio) > 0.02;
  if (!needsCrop) {
    return normalized.uri;
  }

  let cropW: number;
  let cropH: number;
  let cropX: number;
  let cropY: number;
  if (curRatio > targetRatio) {
    cropH = normH;
    cropW = Math.round(normH * targetRatio);
    cropX = Math.round((normW - cropW) / 2);
    cropY = 0;
  } else {
    cropW = normW;
    cropH = Math.round(normW / targetRatio);
    cropX = 0;
    cropY = Math.round((normH - cropH) / 2);
  }
  const result = await ImageManipulator.manipulateAsync(
    normalized.uri,
    [{ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export function CameraPreviewScreen({ imageUri, physicalOrientation = 'portrait', onRetake, onSave }: CameraPreviewScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const [currentUri, setCurrentUri] = useState(imageUri);
  const [showCrop, setShowCrop] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isPreparing, setIsPreparing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCurrentUri(imageUri);
    setIsPreparing(true);

    void (async () => {
      try {
        const processedUri = await normalizeCapturedImage(imageUri, physicalOrientation);
        if (!cancelled) {
          setCurrentUri(processedUri);
        }
      } catch {
        // 失敗時は raw をそのまま使う
      } finally {
        if (!cancelled) {
          setIsPreparing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUri, physicalOrientation]);

  const handleRotate = async (direction: 'left' | 'right') => {
    if (isRotating) return;
    setIsRotating(true);
    try {
      const rotation = direction === 'right' ? 90 : -90;
      const result = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ rotate: rotation }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );
      log('[Preview] 回転完了', { w: result.width, h: result.height, dir: direction });
      setCurrentUri(result.uri);
    } catch {
      // ignore
    } finally {
      setIsRotating(false);
    }
  };

  const handleCropDone = (croppedUri: string) => {
    log('[Preview] トリミング完了', { uri: croppedUri.slice(-40) });
    setCurrentUri(croppedUri);
    setShowCrop(false);
  };

  return (
    <View style={styles.container}>
      {/* safe area スペーサー — 状態更新後も確実にノッチ下から開始 */}
      <View style={{ height: insets.top, backgroundColor: '#000' }} />

      {/* 4:3 固定コンテナで画像を表示 */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: currentUri }}
          style={styles.previewImage}
          contentFit="contain"
          transition={0}
        />
        {(isRotating || isPreparing) && (
          <View style={styles.rotatingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            {isPreparing && <Text style={styles.processingText}>画像を調整中...</Text>}
          </View>
        )}
      </View>

      {/* 回転ボタン */}
      <View style={styles.rotateRow}>
        <TouchableOpacity
          style={styles.rotateBtn}
          onPress={() => handleRotate('left')}
          disabled={isRotating || isPreparing}
          activeOpacity={0.7}
        >
          <RotateCcw size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rotateBtn}
          onPress={() => handleRotate('right')}
          disabled={isRotating || isPreparing}
          activeOpacity={0.7}
        >
          <RotateCw size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* メインアクションボタン */}
      <View style={[styles.actions, { paddingBottom: ACTION_GAP + bottomInset }]}>
        <TouchableOpacity
          style={styles.retakeButton}
          onPress={onRetake}
          activeOpacity={0.8}
        >
          <RefreshCw size={18} color="#333" />
          <Text style={styles.retakeText}>再撮影</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cropButton}
          onPress={() => setShowCrop(true)}
          disabled={isPreparing}
          activeOpacity={0.8}
        >
          <Crop size={18} color="#4A90E2" />
          <Text style={styles.cropText}>トリミング</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => onSave(currentUri)}
          disabled={isPreparing}
          activeOpacity={0.8}
        >
          <Check size={18} color="#fff" />
          <Text style={styles.saveText}>保存</Text>
        </TouchableOpacity>
      </View>

      <ImageCropEditor
        visible={showCrop}
        imageUri={currentUri}
        onCrop={handleCropDone}
        onCancel={() => setShowCrop(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    width: PREVIEW_W,
    height: PREVIEW_H,
    alignSelf: 'center',
    backgroundColor: '#000',
  },
  previewImage: {
    width: PREVIEW_W,
    height: PREVIEW_H,
    backgroundColor: '#000',
  },
  rotatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  rotateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 8,
    backgroundColor: '#000',
  },
  rotateBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: '#000',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
  },
  retakeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A90E2',
    justifyContent: 'center',
  },
  cropText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
