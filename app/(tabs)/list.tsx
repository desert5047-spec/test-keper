import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';

interface Section {
  title: string;
  data: TestRecord[];
}

export default function ListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    if (params.year && params.month) {
      setYear(parseInt(params.year as string));
      setSelectedMonth(parseInt(params.month as string));
    }
  }, [params]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [year, selectedMonth])
  );

  const loadRecords = async () => {
    const startDate = `${year}-${String(selectedMonth).padStart(2, '0')}-01`;
    const endDate = new Date(year, selectedMonth, 0);
    const endDateStr = `${year}-${String(selectedMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data } = await supabase
      .from('records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      const grouped = data.reduce((acc, record) => {
        const dateKey = record.date;
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(record);
        return acc;
      }, {} as Record<string, TestRecord[]>);

      const sectionsData: Section[] = Object.keys(grouped)
        .sort((a, b) => b.localeCompare(a))
        .map((date) => ({
          title: date,
          data: grouped[date],
        }));

      setSections(sectionsData);
    } else {
      setSections([]);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const formatEvaluation = (record: TestRecord) => {
    if (record.score !== null) {
      return `${record.score}点（${record.max_score}点中）`;
    }
    return record.stamp || '';
  };

  const goToPreviousYear = () => {
    setYear(year - 1);
  };

  const goToNextYear = () => {
    setYear(year + 1);
  };

  const renderItem = ({ item }: { item: TestRecord }) => {
    return (
      <TouchableOpacity
        style={styles.recordItem}
        onPress={() => router.push(`/detail?id=${item.id}`)}
        activeOpacity={0.8}>
        {item.photo_uri && (
          <View style={styles.thumbnailContainer}>
            <View
              style={[
                styles.thumbnailWrapper,
                {
                  transform: [{ rotate: `${item.photo_rotation}deg` }],
                },
              ]}>
              <Image
                source={{ uri: item.photo_uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            </View>
          </View>
        )}
        <View style={styles.recordContent}>
          <View style={styles.recordHeader}>
            <View style={styles.subjectChip}>
              <Text style={styles.subjectChipText}>{item.subject}</Text>
            </View>
            <Text style={styles.typeText}>{item.type}</Text>
          </View>
          <Text style={styles.evaluationText}>{formatEvaluation(item)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{formatDate(section.title)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.yearSelector}>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={goToPreviousYear}
            activeOpacity={0.7}>
            <ChevronLeft size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.yearText}>{year}年</Text>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={goToNextYear}
            activeOpacity={0.7}>
            <ChevronRight size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.monthTabs}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
            <TouchableOpacity
              key={month}
              style={[
                styles.monthTab,
                selectedMonth === month && styles.monthTabSelected,
              ]}
              onPress={() => setSelectedMonth(month)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.monthTabText,
                  selectedMonth === month && styles.monthTabTextSelected,
                ]}>
                {month}月
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {year}年{selectedMonth}月の記録はありません
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 20,
  },
  yearButton: {
    padding: 4,
  },
  yearText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    minWidth: 80,
    textAlign: 'center',
  },
  monthTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  monthTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  monthTabSelected: {
    backgroundColor: '#4A90E2',
  },
  monthTabText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Nunito-SemiBold',
  },
  monthTabTextSelected: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#666',
  },
  recordItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnailContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailWrapper: {
    width: '100%',
    height: '100%',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  recordContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  subjectChip: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Nunito-SemiBold',
  },
  typeText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Nunito-Regular',
  },
  evaluationText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Nunito-SemiBold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
  },
});
