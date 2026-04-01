import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { X, RotateCw, Zap, ZapOff, RectangleHorizontal, RectangleVertical } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { Accelerometer } from 'expo-sensors';
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
  const [torchOn, setTorchOn] = useState(false);
  const [captureOrientation, setCaptureOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const cameraRef = useRef<CameraView>(null);
  const { safeBottom } = useSafeBottom(16);
  const shutterFlash = useRef(new Animated.Value(0)).current;

  const deviceOrientationRef = useRef<'portrait' | 'landscape'>('portrait');
  const accelDataRef = useRef({ x: 0, y: -1, z: 0 });

  const fireShutterFlash = useCallback(() => {
    shutterFlash.setValue(1);
    Animated.timing(shutterFlash, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [shutterFlash]);

  const toggleFacing = useCallback(() => {
    setTorchOn(false);
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  const toggleTorch = useCallback(() => {
    setTorchOn((v) => !v);
  }, []);

  useEffect(() => {
    const HYSTERESIS = 0.2;
    Accelerometer.setUpdateInterval(200);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      accelDataRef.current = { x, y, z };
      const absX = Math.abs(x);
      const absY = Math.abs(y);
      const prev = deviceOrientationRef.current;
      let next = prev;
      if (prev === 'portrait' && absX > absY + HYSTERESIS) {
        next = 'landscape';
      } else if (prev === 'landscape' && absY > absX + HYSTERESIS) {
        next = 'portrait';
      }
      deviceOrientationRef.current = next;
      if (!isCapturing && next !== prev) {
        setCaptureOrientation(next);
      }
    });
    return () => sub.remove();
  }, [isCapturing]);

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
      fireShutterFlash();
      const t0 = Date.now();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true,
        skipProcessing: true,
      });

      if (!photo.uri) {
        throw new Error('写真のURIが取得できませんでした');
      }

      const accel = accelDataRef.current;
      const physicalOri = deviceOrientationRef.current;
      const isPhysicalLandscape = physicalOri === 'landscape';

      // Step 1: EXIF 正規化のみ（実サイズを確定させる）
      const normalized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ rotate: 0 }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );
      const normW = normalized.width;
      const normH = normalized.height;

      let result;

      if (isPhysicalLandscape) {
        // Step 2a: landscape → 回転 + 必要なら crop
        const extraRotation = accel.x > 0 ? -90 : 90;
        const postW = normH;
        const postH = normW;
        const targetRatio = 4 / 3;
        const curRatio = postW / postH;
        const needsCrop = Number.isFinite(curRatio) && Math.abs(curRatio - targetRatio) > 0.02;

        const actions2: ImageManipulator.Action[] = [{ rotate: extraRotation }];

        if (needsCrop) {
          let cropW: number, cropH: number, cropX: number, cropY: number;
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
          actions2.push({ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } });
        }

        result = await ImageManipulator.manipulateAsync(
          normalized.uri,
          actions2,
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );

        debugLog('[CameraScreen] === landscape 処理 ===');
        debugLog('[CameraScreen] photo(raw)', { w: photo.width, h: photo.height });
        debugLog('[CameraScreen] exif', photo.exif?.Orientation ?? 'none');
        debugLog('[CameraScreen] normalized(実際)', { w: normW, h: normH });
        debugLog('[CameraScreen] accel', { x: accel.x.toFixed(2), y: accel.y.toFixed(2) });
        debugLog('[CameraScreen] extraRotation', extraRotation);
        debugLog('[CameraScreen] postRot', { w: postW, h: postH });
        debugLog('[CameraScreen] needsCrop', needsCrop);
        debugLog('[CameraScreen] result', { w: result.width, h: result.height });
        debugLog('[CameraScreen] totalMs', Date.now() - t0);
        debugLog('[CameraScreen] ========================');
      } else {
        // Step 2b: portrait → 必要なら crop のみ
        const targetRatio = 3 / 4;
        const curRatio = normW / normH;
        const needsCrop = Number.isFinite(curRatio) && Math.abs(curRatio - targetRatio) > 0.02;

        if (needsCrop) {
          let cropW: number, cropH: number, cropX: number, cropY: number;
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
          result = await ImageManipulator.manipulateAsync(
            normalized.uri,
            [{ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
          );
        } else {
          result = await ImageManipulator.manipulateAsync(
            normalized.uri,
            [],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
          );
        }

        debugLog('[CameraScreen] === portrait 処理 ===');
        debugLog('[CameraScreen] photo(raw)', { w: photo.width, h: photo.height });
        debugLog('[CameraScreen] normalized(実際)', { w: normW, h: normH });
        debugLog('[CameraScreen] needsCrop', needsCrop);
        debugLog('[CameraScreen] result', { w: result.width, h: result.height });
        debugLog('[CameraScreen] totalMs', Date.now() - t0);
        debugLog('[CameraScreen] ========================');
      }

      setCaptureOrientation(physicalOri);
      onCapture(result.uri);
    } catch (error: any) {
      logError('[CameraScreen] 撮影エラー');
    } finally {
      setIsCapturing(false);
    }
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
        <View style={styles.orientationBadge} pointerEvents="none">
          {captureOrientation === 'landscape' ? (
            <RectangleHorizontal size={18} color="#fff" />
          ) : (
            <RectangleVertical size={18} color="#fff" />
          )}
        </View>
      </SafeAreaView>

      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.cameraView}
          facing={facing}
          mode="picture"
          enableTorch={torchOn}
        >
          {/* L字コーナーガイド */}
          <View style={styles.cornerOverlay} pointerEvents="none">
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
          </View>

        </CameraView>

        {/* シャッターフラッシュ */}
        <Animated.View
          style={[styles.shutterFlash, { opacity: shutterFlash }]}
          pointerEvents="none"
        />
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

        <TouchableOpacity
          style={[styles.torchButton, torchOn && styles.torchButtonOn]}
          onPress={toggleTorch}
          activeOpacity={0.7}
        >
          {torchOn ? <Zap size={22} color="#FFD600" /> : <ZapOff size={22} color="#fff" />}
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orientationBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
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
  shutterFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
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
  torchButton: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  torchButtonOn: {
    backgroundColor: 'rgba(255,214,0,0.25)',
  },
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
