import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw, Check } from 'lucide-react-native';

const ACTION_GAP = Platform.select({ android: 20, default: 16 }) as number;

interface CameraPreviewScreenProps {
  imageUri: string;
  onRetake: () => void;
  onSave: () => void;
}

/**
 * 撮影後のプレビュー画面。「再撮影」「保存」をアプリ側で表示（OS標準の Retake/Use Photo を使わない）
 */
export function CameraPreviewScreen({ imageUri, onRetake, onSave }: CameraPreviewScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12); // ナビ回避（最低12）

  return (
    <SafeAreaView style={[styles.container, { flex: 1 }]} edges={['top']}>
      <View style={styles.contentWrap}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" />
        </View>
      </View>
      <View style={[styles.actions, { paddingBottom: ACTION_GAP + bottomInset }]}>
        <TouchableOpacity
          style={styles.retakeButton}
          onPress={onRetake}
          activeOpacity={0.8}>
          <RotateCcw size={22} color="#333" />
          <Text style={styles.retakeText}>再撮影</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={onSave}
          activeOpacity={0.8}>
          <Check size={22} color="#fff" />
          <Text style={styles.saveText}>保存</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    width: '100%',
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  contentWrap: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: '#000',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 140,
    justifyContent: 'center',
  },
  retakeText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    minWidth: 140,
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
