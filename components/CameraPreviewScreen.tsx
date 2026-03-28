import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw, RotateCw, Check, Crop, RefreshCw } from 'lucide-react-native';
import { ImageCropEditor } from './ImageCropEditor';
import * as ImageManipulator from 'expo-image-manipulator';

const ACTION_GAP = Platform.select({ android: 20, default: 16 }) as number;

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

  const handleRotate = async (direction: 'left' | 'right') => {
    if (isRotating) return;
    setIsRotating(true);
    try {
      const rotation = direction === 'right' ? 90 : -90;
      const result = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ rotate: rotation }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCurrentUri(result.uri);
    } catch {
      // ignore
    } finally {
      setIsRotating(false);
    }
  };

  const handleCropDone = (croppedUri: string) => {
    setCurrentUri(croppedUri);
    setShowCrop(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.contentWrap}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: currentUri }} style={styles.image} contentFit="contain" />
          {isRotating && (
            <View style={styles.rotatingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </View>
      </View>

      {/* 回転ボタン（画像の上に配置） */}
      <View style={styles.rotateRow}>
        <TouchableOpacity
          style={styles.rotateBtn}
          onPress={() => handleRotate('left')}
          disabled={isRotating}
          activeOpacity={0.7}>
          <RotateCcw size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rotateBtn}
          onPress={() => handleRotate('right')}
          disabled={isRotating}
          activeOpacity={0.7}>
          <RotateCw size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* メインアクションボタン */}
      <View style={[styles.actions, { paddingBottom: ACTION_GAP + bottomInset }]}>
        <TouchableOpacity
          style={styles.retakeButton}
          onPress={onRetake}
          activeOpacity={0.8}>
          <RefreshCw size={18} color="#333" />
          <Text style={styles.retakeText}>再撮影</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cropButton}
          onPress={() => setShowCrop(true)}
          activeOpacity={0.8}>
          <Crop size={18} color="#4A90E2" />
          <Text style={styles.cropText}>トリミング</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => onSave(currentUri)}
          activeOpacity={0.8}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentWrap: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
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
