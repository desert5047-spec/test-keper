import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';

export default function HomeScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [])
  );

  const loadRecords = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data } = await supabase
      .from('records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setRecords(data);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatEvaluation = (record: TestRecord) => {
    if (record.score !== null) {
      return `${record.score}点（${record.max_score}点中）`;
    }
    return record.stamp || '';
  };

  const renderRecord = ({ item }: { item: TestRecord }) => {
    const hasPhoto = !!item.photo_uri;

    return (
      <TouchableOpacity
        style={[styles.card, !hasPhoto && styles.cardSmall]}
        onPress={() => router.push(`/detail?id=${item.id}`)}
        activeOpacity={0.8}>
        {hasPhoto && (
          <View style={styles.imageContainer}>
            <View
              style={[
                styles.imageWrapper,
                {
                  transform: [{ rotate: `${item.photo_rotation}deg` }],
                },
              ]}>
              <Image
                source={{ uri: item.photo_uri! }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.dateOverlay}>
              <Text style={styles.dateOverlayText}>{formatDate(item.date)}</Text>
            </View>
          </View>
        )}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.subjectChip}>
              <Text style={styles.subjectChipText}>{item.subject}</Text>
            </View>
            <Text style={styles.typeText}>{item.type}</Text>
          </View>
          <Text style={styles.evaluationText}>{formatEvaluation(item)}</Text>
          {!hasPhoto && (
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>今月の記録</Text>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>まだ記録がありません</Text>
          <Text style={styles.emptySubText}>＋ボタンから記録を残しましょう</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardSmall: {
    paddingVertical: 12,
  },
  imageContainer: {
    position: 'relative',
    height: 240,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  dateOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dateOverlayText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  cardContent: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  subjectChip: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  typeText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  evaluationText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
});
