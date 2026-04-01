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
import { X, RotateCw, Zap, ZapOff } from 'lucide-react-native';
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
  const [torchOn, setTorchOn] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { safeBottom } = useSafeBottom(16);
  const shutterFlash = useRef(new Animated.Value(0)).current;

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
        skipProcessing: true,
      });

      const t1 = Date.now();
      debugLog('[CameraScreen] 撮影完了', { ms: t1 - t0, w: photo.width, h: photo.height });

      if (!photo.uri) {
        throw new Error('写真のURIが取得できませんでした');
      }

      const rawW = photo.width;
      const rawH = photo.height;
      const estW = rawW > rawH ? rawH : rawW;
      const estH = rawW > rawH ? rawW : rawH;

      const targetRatio = 3 / 4;
      const estRatio = estW / estH;
      const needsCrop = Math.abs(estRatio - targetRatio) > 0.02;

      const actions: ImageManipulator.Action[] = [{ rotate: 0 }];

      if (needsCrop) {
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
        actions.push({ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } });
      }

      const result = await ImageManipulator.manipulateAsync(
        photo.uri,
        actions,
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      debugLog('[CameraScreen] 処理完了', {
        totalMs: Date.now() - t0,
        shotMs: t1 - t0,
        procMs: Date.now() - t1,
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
