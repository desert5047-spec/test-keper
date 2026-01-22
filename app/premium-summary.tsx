import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';

export default function PremiumSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [featuredRecord, setFeaturedRecord] = useState<TestRecord | null>(null);
  const [encouragementMessage, setEncouragementMessage] = useState<string>('');

  useEffect(() => {
    if (params.year && params.month) {
      loadMonthRecords(
        parseInt(params.year as string),
        parseInt(params.month as string)
      );
    }
  }, [params]);

  const loadMonthRecords = async (year: number, month: number) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(
      endDate.getDate()
    ).padStart(2, '0')}`;

    const { data } = await supabase
      .from('records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false });

    if (data && data.length > 0) {
      setRecords(data);
      checkEncouragement(data);
    }
  };

  const checkEncouragement = (records: TestRecord[]) => {
    const hasHighScore = records.some(
      (r) => r.score !== null && r.score >= 80
    );
    const hasExcellentStamp = records.some(
      (r) => r.stamp === '大変よくできました'
    );

    if (hasHighScore) {
      const highScoreRecord = records.find(
        (r) => r.score !== null && r.score >= 80
      );
      if (highScoreRecord) {
        setFeaturedRecord(highScoreRecord);
        setEncouragementMessage(
          'この月は、80点以上のテストもありました。'
        );
      }
    } else if (hasExcellentStamp) {
      const excellentRecord = records.find(
        (r) => r.stamp === '大変よくできました'
      );
      if (excellentRecord) {
        setFeaturedRecord(excellentRecord);
        setEncouragementMessage(
          '点数がなくても、がんばりは残っています。'
        );
      }
    }
  };

  const year = params.year as string;
  const month = params.month as string;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {year}年{month}月のまとめ
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>有料機能</Text>
        </View>

        <Text style={styles.title}>
          {year}年{month}月の記録
        </Text>
        <Text style={styles.subtitle}>
          この月は{records.length}件の記録が残っています
        </Text>

        {featuredRecord && (
          <View style={styles.featuredContainer}>
            {featuredRecord.photo_uri && (
              <View style={styles.featuredImageContainer}>
                <View
                  style={[
                    styles.featuredImageWrapper,
                    {
                      transform: [
                        { rotate: `${featuredRecord.photo_rotation}deg` },
                      ],
                    },
                  ]}>
                  <Image
                    source={{ uri: featuredRecord.photo_uri }}
                    style={styles.featuredImage}
                    resizeMode="cover"
                  />
                </View>
              </View>
            )}
            <Text style={styles.encouragementText}>
              {encouragementMessage}
            </Text>
          </View>
        )}

        <View style={styles.albumSection}>
          <Text style={styles.albumTitle}>記録アルバム</Text>
          <View style={styles.albumGrid}>
            {records.map((record) => (
              <View key={record.id} style={styles.albumItem}>
                {record.photo_uri ? (
                  <View style={styles.albumImageContainer}>
                    <View
                      style={[
                        styles.albumImageWrapper,
                        {
                          transform: [
                            { rotate: `${record.photo_rotation}deg` },
                          ],
                        },
                      ]}>
                      <Image
                        source={{ uri: record.photo_uri }}
                        style={styles.albumImage}
                        resizeMode="cover"
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.albumPlaceholder}>
                    <Text style={styles.albumPlaceholderText}>
                      {record.subject}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>有料機能について</Text>
          <Text style={styles.infoText}>
            この画面は有料機能のデモ表示です。
          </Text>
          <Text style={styles.infoText}>
            実際の有料機能では、月ごとの記録をアルバムのように眺めることができます。
          </Text>
          <Text style={styles.infoSubText}>
            ※成績分析や改善提案は行いません
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 20,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
  },
  featuredContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuredImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredImageWrapper: {
    width: '100%',
    height: '100%',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  encouragementText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  albumSection: {
    marginBottom: 24,
  },
  albumTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  albumItem: {
    width: '31%',
    aspectRatio: 1,
  },
  albumImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumImageWrapper: {
    width: '100%',
    height: '100%',
  },
  albumImage: {
    width: '100%',
    height: '100%',
  },
  albumPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumPlaceholderText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  infoSubText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
});
