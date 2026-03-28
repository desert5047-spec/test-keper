import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { X, RotateCw } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { log, error as logError } from '@/lib/logger';
import { useSafeBottom } from '@/lib/useSafeBottom';

const debugLog = log;
const { width: SCREEN_W } = Dimensions.get('window');

const CAMERA_W = SCREEN_W;
const CAMERA_H = Math.round(SCREEN_W * (4 / 3));

interface CameraScreenProps {
  onCapture: (uri: string) => void;
  onCancel: () => void;
}

export function CameraScreen({ onCapture, onCancel }: CameraScreenProps) {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { safeBottom } = useSafeBottom(16);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>カメラの権限が必要です</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>権限を許可</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
          <Text style={styles.buttonText}>キャンセル</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const t0 = Date.now();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: true,
      });

      debugLog('[CameraScreen] 撮影完了', {
        ms: Date.now() - t0,
        w: photo.width,
        h: photo.height,
      });

      if (!photo.uri) {
        throw new Error('写真のURIが取得できませんでした');
      }

      // EXIF 正規化後の寸法を予測し、EXIF bake + 3:4 crop を 1 回の
      // manipulateAsync にまとめる（2回→1回で大幅高速化）
      const rawW = photo.width;
      const rawH = photo.height;

      // portrait ロックアプリ: センサー横長 (W>H) → EXIF で縦横入替
      const estW = rawW > rawH ? rawH : rawW;
      const estH = rawW > rawH ? rawW : rawH;

      const actions: ImageManipulator.Action[] = [{ rotate: 0 }];

      const targetRatio = 3 / 4;
      const estRatio = estW / estH;

      if (Math.abs(estRatio - targetRatio) > 0.02) {
        let cropW: number, cropH: number, cropX: number, cropY: number;
        if (estRatio > targetRatio) {
          cropH = estH;
          cropW = Math.round(estH * targetRatio);
          cropX = Math.round((estW - cropW) / 2);
          cropY = 0;
        } else {
          cropW = estW;
          cropH = Math.round(estW / targetRatio);
          cropX = 0;
          cropY = Math.round((estH - cropH) / 2);
        }
        actions.push({
          crop: { originX: cropX, originY: cropY, width: cropW, height: cropH },
        });
        debugLog('[CameraScreen] EXIF+crop 1回実行', {
          est: `${estW}x${estH}`,
          crop: `${cropW}x${cropH}`,
        });
      } else {
        debugLog('[CameraScreen] EXIF のみ（3:4 済み）');
      }

      const result = await ImageManipulator.manipulateAsync(
        photo.uri,
        actions,
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );

      debugLog('[CameraScreen] 処理完了', {
        totalMs: Date.now() - t0,
        w: result.width,
        h: result.height,
      });

      onCapture(result.uri);
    } catch (error: any) {
      logError('[CameraScreen] 撮影エラー');
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerArea}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <X size={28} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.cameraView}
          facing={facing}
          mode="picture"
        >
          <View style={styles.cornerOverlay} pointerEvents="none">
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
          </View>
        </CameraView>
      </View>

      <View style={[styles.controls, { paddingBottom: safeBottom + 8 }]}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={toggleFacing}
          activeOpacity={0.7}
        >
          <RotateCw size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
          onPress={handleCapture}
          disabled={isCapturing}
          activeOpacity={0.8}
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={styles.captureButtonInner} />
          )}
        </TouchableOpacity>

        <View style={styles.placeholder} />
      </View>
    </View>
  );
}

const CORNER_LEN = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerArea: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraWrap: {
    width: CAMERA_W,
    height: CAMERA_H,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  cameraView: {
    width: CAMERA_W,
    height: CAMERA_H,
  },
  cornerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  corner: {
    position: 'absolute',
    width: CORNER_LEN,
    height: CORNER_LEN,
  },
  cTL: {
    top: 4, left: 4,
    borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cTR: {
    top: 4, right: 4,
    borderTopWidth: CORNER_W, borderRightWidth: CORNER_W,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cBL: {
    bottom: 4, left: 4,
    borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cBR: {
    bottom: 4, right: 4,
    borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  controls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  flipButton: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  captureButton: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: '#fff',
  },
  captureButtonDisabled: { opacity: 0.5 },
  captureButtonInner: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff',
  },
  placeholder: { width: 50, height: 50 },
  message: {
    color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 20,
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 8, marginBottom: 12,
  },
  cancelButton: { backgroundColor: '#666' },
  buttonText: {
    color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center',
  },
});
