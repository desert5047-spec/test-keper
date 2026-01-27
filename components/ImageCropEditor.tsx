import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  PanResponder,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const MIN_CROP_SIZE = 100;

interface ImageCropEditorProps {
  visible: boolean;
  imageUri: string;
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
}

export function ImageCropEditor({ visible, imageUri, onCrop, onCancel }: ImageCropEditorProps) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-top-left' | 'resize-top-right' | 'resize-bottom-left' | 'resize-bottom-right' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const loadImageSize = async () => {
      if (visible && imageUri) {
        try {
          await new Promise<void>((resolve, reject) => {
            Image.getSize(
              imageUri,
              (width, height) => {
                setImageSize({ width, height });
                
                // 画面に収まるように画像の表示サイズを計算
                const maxWidth = SCREEN_WIDTH - CONTAINER_PADDING * 2;
                const maxHeight = SCREEN_HEIGHT * 0.6;
                const aspectRatio = width / height;
                
                let displayWidth = maxWidth;
                let displayHeight = maxWidth / aspectRatio;
                
                if (displayHeight > maxHeight) {
                  displayHeight = maxHeight;
                  displayWidth = maxHeight * aspectRatio;
                }
                
                setDisplaySize({ width: displayWidth, height: displayHeight });
                
                // 初期トリミング領域を設定（画像全体の80%）
                const initialCropSize = Math.min(displayWidth, displayHeight) * 0.8;
                setCropArea({
                  x: (displayWidth - initialCropSize) / 2,
                  y: (displayHeight - initialCropSize) / 2,
                  width: initialCropSize,
                  height: initialCropSize,
                });
                resolve();
              },
              (error) => {
                console.error('画像サイズ取得エラー:', error);
                reject(error);
              }
            );
          });
        } catch (error) {
          console.error('画像サイズ取得エラー:', error);
        }
      }
    };
    
    loadImageSize();
  }, [visible, imageUri]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const { x, y, width, height } = cropArea;
      
      // コーナーの判定（20px以内）
      const cornerSize = 30;
      const isTopLeft = locationX >= x - cornerSize && locationX <= x + cornerSize &&
                        locationY >= y - cornerSize && locationY <= y + cornerSize;
      const isTopRight = locationX >= x + width - cornerSize && locationX <= x + width + cornerSize &&
                        locationY >= y - cornerSize && locationY <= y + cornerSize;
      const isBottomLeft = locationX >= x - cornerSize && locationX <= x + cornerSize &&
                          locationY >= y + height - cornerSize && locationY <= y + height + cornerSize;
      const isBottomRight = locationX >= x + width - cornerSize && locationX <= x + width + cornerSize &&
                           locationY >= y + height - cornerSize && locationY <= y + height + cornerSize;
      
      if (isTopLeft) {
        setDragType('resize-top-left');
      } else if (isTopRight) {
        setDragType('resize-top-right');
      } else if (isBottomLeft) {
        setDragType('resize-bottom-left');
      } else if (isBottomRight) {
        setDragType('resize-bottom-right');
      } else if (locationX >= x && locationX <= x + width && locationY >= y && locationY <= y + height) {
        setDragType('move');
      } else {
        setDragType(null);
      }
      
      setDragStart({ x: locationX, y: locationY });
    },
    onPanResponderMove: (evt, gestureState) => {
      if (!dragType) return;
      
      const { dx, dy } = gestureState;
      const { x, y, width, height } = cropArea;
      
      if (dragType === 'move') {
        // トリミング領域を移動
        const newX = Math.max(0, Math.min(displaySize.width - width, x + dx));
        const newY = Math.max(0, Math.min(displaySize.height - height, y + dy));
        setCropArea({ ...cropArea, x: newX, y: newY });
      } else {
        // リサイズ
        let newX = x;
        let newY = y;
        let newWidth = width;
        let newHeight = height;
        
        if (dragType === 'resize-top-left') {
          newX = Math.max(0, x + dx);
          newY = Math.max(0, y + dy);
          newWidth = Math.max(MIN_CROP_SIZE, width - dx);
          newHeight = Math.max(MIN_CROP_SIZE, height - dy);
          if (newX + newWidth > displaySize.width) {
            newWidth = displaySize.width - newX;
          }
          if (newY + newHeight > displaySize.height) {
            newHeight = displaySize.height - newY;
          }
        } else if (dragType === 'resize-top-right') {
          newY = Math.max(0, y + dy);
          newWidth = Math.max(MIN_CROP_SIZE, width + dx);
          newHeight = Math.max(MIN_CROP_SIZE, height - dy);
          if (newX + newWidth > displaySize.width) {
            newWidth = displaySize.width - newX;
          }
          if (newY + newHeight > displaySize.height) {
            newHeight = displaySize.height - newY;
          }
        } else if (dragType === 'resize-bottom-left') {
          newX = Math.max(0, x + dx);
          newWidth = Math.max(MIN_CROP_SIZE, width - dx);
          newHeight = Math.max(MIN_CROP_SIZE, height + dy);
          if (newX + newWidth > displaySize.width) {
            newWidth = displaySize.width - newX;
          }
          if (newY + newHeight > displaySize.height) {
            newHeight = displaySize.height - newY;
          }
        } else if (dragType === 'resize-bottom-right') {
          newWidth = Math.max(MIN_CROP_SIZE, width + dx);
          newHeight = Math.max(MIN_CROP_SIZE, height + dy);
          if (newX + newWidth > displaySize.width) {
            newWidth = displaySize.width - newX;
          }
          if (newY + newHeight > displaySize.height) {
            newHeight = displaySize.height - newY;
          }
        }
        
        setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight });
      }
    },
    onPanResponderRelease: () => {
      setDragType(null);
    },
  });

  const handleCrop = async () => {
    if (!imageUri || !imageSize.width || !imageSize.height) return;
    
    setIsProcessing(true);
    try {
      // 表示サイズから実際の画像サイズへの変換率を計算
      const scaleX = imageSize.width / displaySize.width;
      const scaleY = imageSize.height / displaySize.height;
      
      // トリミング領域を実際の画像サイズに変換
      const cropX = Math.round(cropArea.x * scaleX);
      const cropY = Math.round(cropArea.y * scaleY);
      const cropWidth = Math.round(cropArea.width * scaleX);
      const cropHeight = Math.round(cropArea.height * scaleY);
      
      // 画像をトリミング
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: cropX,
              originY: cropY,
              width: cropWidth,
              height: cropHeight,
            },
          },
        ],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      onCrop(result.uri);
    } catch (error: any) {
      console.error('トリミングエラー:', error);
      Alert.alert('エラー', 'トリミングに失敗しました: ' + (error.message || '不明なエラー'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!visible || !imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>写真をトリミング</Text>
          <TouchableOpacity
            onPress={handleCrop}
            style={[styles.doneButton, isProcessing && styles.doneButtonDisabled]}
            disabled={isProcessing}>
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Check size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.imageContainer}>
          <View
            style={[
              styles.imageWrapper,
              { width: displaySize.width, height: displaySize.height },
            ]}
            {...panResponder.panHandlers}>
            <Image
              source={{ uri: imageUri }}
              style={[styles.image, { width: displaySize.width, height: displaySize.height }]}
              resizeMode="contain"
            />
            
            {/* トリミング領域のオーバーレイ */}
            <View style={styles.overlay}>
              {/* 上部の暗い領域 */}
              <View style={[styles.overlayTop, { height: cropArea.y }]} />
              
              {/* 中央の行 */}
              <View style={styles.overlayMiddle}>
                {/* 左側の暗い領域 */}
                <View style={[styles.overlayLeft, { width: cropArea.x }]} />
                
                {/* トリミング領域（透明） */}
                <View
                  style={[
                    styles.cropArea,
                    {
                      width: cropArea.width,
                      height: cropArea.height,
                    },
                  ]}>
                  {/* コーナーハンドル */}
                  <View style={[styles.cornerHandle, styles.topLeft]} />
                  <View style={[styles.cornerHandle, styles.topRight]} />
                  <View style={[styles.cornerHandle, styles.bottomLeft]} />
                  <View style={[styles.cornerHandle, styles.bottomRight]} />
                </View>
                
                {/* 右側の暗い領域 */}
                <View
                  style={[
                    styles.overlayRight,
                    { width: displaySize.width - cropArea.x - cropArea.width },
                  ]}
                />
              </View>
              
              {/* 下部の暗い領域 */}
              <View
                style={[
                  styles.overlayBottom,
                  { height: displaySize.height - cropArea.y - cropArea.height },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            コーナーをドラッグしてサイズを調整、中央をドラッグして位置を移動
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    zIndex: 10,
  },
  cancelButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#fff',
  },
  doneButton: {
    padding: 8,
    backgroundColor: '#4A90E2',
    borderRadius: 20,
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: CONTAINER_PADDING,
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    borderRadius: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayTop: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: '100%',
  },
  overlayMiddle: {
    flexDirection: 'row',
    flex: 1,
  },
  overlayLeft: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    height: '100%',
  },
  overlayRight: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    height: '100%',
  },
  overlayBottom: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: '100%',
  },
  cropArea: {
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderStyle: 'dashed',
    position: 'relative',
  },
  cornerHandle: {
    position: 'absolute',
    width: 30,
    height: 30,
    backgroundColor: '#4A90E2',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 15,
  },
  topLeft: {
    top: -15,
    left: -15,
  },
  topRight: {
    top: -15,
    right: -15,
  },
  bottomLeft: {
    bottom: -15,
    left: -15,
  },
  bottomRight: {
    bottom: -15,
    right: -15,
  },
  instructions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#fff',
    textAlign: 'center',
  },
});
