import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw, RotateCw, Check, Crop, RefreshCw, ScanText, X } from 'lucide-react-native';
import { ImageCropEditor } from './ImageCropEditor';
import * as ImageManipulator from 'expo-image-manipulator';
import { log } from '@/lib/logger';
import { recognizeText, type OcrResult } from '@/utils/ocr';

const ACTION_GAP = Platform.select({ android: 20, default: 16 }) as number;
const { width: SCREEN_W } = Dimensions.get('window');

const PREVIEW_W = SCREEN_W;
const PREVIEW_H = Math.round(SCREEN_W * (4 / 3));

interface CameraPreviewScreenProps {
  imageUri: string;
  onRetake: () => void;
  onSave: (uri: string) => void;
}

export function CameraPreviewScreen({ imageUri, onRetake, onSave }: CameraPreviewScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const [currentUri, setCurrentUri] = useState(imageUri);
  const [showCrop, setShowCrop] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isOcr, setIsOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [showOcrModal, setShowOcrModal] = useState(false);

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

  const handleOcr = async () => {
    if (isOcr) return;
    setIsOcr(true);
    try {
      const res = await recognizeText(currentUri);
      setOcrResult(res);
      setShowOcrModal(true);
      if (!res.text.trim()) {
        Alert.alert('文字認識', 'テキストが検出されませんでした。');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '不明なエラー';
      log('[OCR] error', msg);
      Alert.alert('文字認識エラー', msg);
    } finally {
      setIsOcr(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* safe area スペーサー — 状態更新後も確実にノッチ下から開始 */}
      <View style={{ height: insets.top, backgroundColor: '#000' }} />

      {/* 4:3 固定コンテナで画像を表示 */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: currentUri }}
          style={{ width: PREVIEW_W, height: PREVIEW_H }}
          contentFit="contain"
        />
        {isRotating && (
          <View style={styles.rotatingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </View>

      {/* 回転ボタン */}
      <View style={styles.rotateRow}>
        <TouchableOpacity
          style={styles.rotateBtn}
          onPress={() => handleRotate('left')}
          disabled={isRotating}
          activeOpacity={0.7}
        >
          <RotateCcw size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rotateBtn}
          onPress={() => handleRotate('right')}
          disabled={isRotating}
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
          activeOpacity={0.8}
        >
          <Crop size={18} color="#4A90E2" />
          <Text style={styles.cropText}>トリミング</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ocrButton}
          onPress={handleOcr}
          disabled={isOcr}
          activeOpacity={0.8}
        >
          {isOcr ? (
            <ActivityIndicator size={18} color="#E67E22" />
          ) : (
            <ScanText size={18} color="#E67E22" />
          )}
          <Text style={styles.ocrText}>文字認識</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => onSave(currentUri)}
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

      {/* OCR 結果モーダル */}
      <Modal
        visible={showOcrModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOcrModal(false)}
      >
        <View style={[styles.ocrModal, { paddingTop: insets.top }]}>
          <View style={styles.ocrHeader}>
            <Text style={styles.ocrTitle}>文字認識結果</Text>
            <TouchableOpacity
              onPress={() => setShowOcrModal(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.ocrScroll}
            contentContainerStyle={[
              styles.ocrScrollContent,
              { paddingBottom: bottomInset + 16 },
            ]}
          >
            {ocrResult?.text.trim() ? (
              <Text style={styles.ocrResultText} selectable>
                {ocrResult.text}
              </Text>
            ) : (
              <Text style={styles.ocrEmpty}>テキストが検出されませんでした</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
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
  },
  rotatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
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
  ocrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E67E22',
    justifyContent: 'center',
  },
  ocrText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E67E22',
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
  ocrModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  ocrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  ocrTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  ocrScroll: {
    flex: 1,
  },
  ocrScrollContent: {
    padding: 16,
  },
  ocrResultText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
  },
  ocrEmpty: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
});
