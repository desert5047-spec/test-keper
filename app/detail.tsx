import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, ArrowLeft, Home } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [record, setRecord] = useState<TestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadRecord(params.id as string);
    }
  }, [params.id]);

  const loadRecord = async (id: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      setRecord(data);
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const getSubjectColor = (subject: string) => {
    const colors: { [key: string]: string } = {
      '国語': '#E74C3C',
      '算数': '#3498DB',
      '理科': '#27AE60',
      '社会': '#E67E22',
      '生活': '#9B59B6',
      '図工': '#F39C12',
      '音楽': '#1ABC9C',
      '体育': '#E91E63',
    };
    return colors[subject] || '#95A5A6';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>記録の詳細</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>記録が見つかりません</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>記録の詳細</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {record.photo_uri && (
          <TouchableOpacity
            onPress={() => setShowImageModal(true)}
            activeOpacity={0.9}
            style={styles.imageContainer}>
            <View
              style={[
                styles.imageWrapper,
                {
                  transform: [{ rotate: `${record.photo_rotation}deg` }],
                },
              ]}>
              <Image
                source={{ uri: record.photo_uri }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.label}>日付</Text>
            <Text style={styles.value}>{formatDate(record.date)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>教科</Text>
            <View style={[styles.subjectChip, { backgroundColor: getSubjectColor(record.subject) }]}>
              <Text style={styles.subjectChipText}>{record.subject}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>種類</Text>
            <Text style={styles.value}>{record.type}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>評価</Text>
            {record.score !== null ? (
              <Text style={styles.valueHighlight}>
                {record.score}点（{record.max_score}点中）
              </Text>
            ) : (
              <Text style={styles.valueHighlight}>{record.stamp}</Text>
            )}
          </View>

          {record.memo && (
            <View style={styles.section}>
              <Text style={styles.label}>メモ</Text>
              <Text style={styles.memoText}>{record.memo}</Text>
            </View>
          )}

          <View style={{ height: 80 }} />
        </View>
      </ScrollView>

      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push('/')}
          activeOpacity={0.7}>
          <Home size={20} color="#fff" />
          <Text style={styles.homeButtonText}>ホーム</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backBottomButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <ArrowLeft size={20} color="#4A90E2" />
          <Text style={styles.backBottomButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowImageModal(false)}
            activeOpacity={0.7}>
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {record.photo_uri && (
            <View
              style={[
                styles.modalImageWrapper,
                {
                  transform: [{ rotate: `${record.photo_rotation}deg` }],
                },
              ]}>
              <Image
                source={{ uri: record.photo_uri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            </View>
          )}
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
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 20,
    gap: 20,
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
  memoText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
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
  modalImage: {
    width: '100%',
    height: '100%',
  },
  bottomButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  homeButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
  },
  backBottomButton: {
    flex: 1,
    backgroundColor: '#F0F8FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A90E2',
    gap: 6,
  },
  backBottomButtonText: {
    color: '#4A90E2',
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
  },
});
