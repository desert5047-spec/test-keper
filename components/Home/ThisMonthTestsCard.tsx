import { View, Text, StyleSheet } from 'react-native';

interface SubjectStat {
  subject: string;
  averageScore: number | null;
  totalCount: number;
}

interface ThisMonthTestsCardProps {
  subjectStats: SubjectStat[];
  count: number;
  getSubjectColor: (subject: string) => string;
}

export function ThisMonthTestsCard({ subjectStats, count, getSubjectColor }: ThisMonthTestsCardProps) {
  return (
    <View style={styles.card}>
      {/* 見出し + バッジ */}
      <View style={styles.header}>
        <Text style={styles.heading}>今月のテスト</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}件</Text>
        </View>
      </View>

      {/* 教科ごとの統計 */}
      {subjectStats.length > 0 && (
        <View style={styles.subjectStatsContainer}>
          {subjectStats.map((stat) => (
            <View key={stat.subject} style={styles.subjectStatRow}>
              <View style={[styles.subjectChip, { backgroundColor: getSubjectColor(stat.subject) }]}>
                <Text style={styles.subjectChipText}>{stat.subject}</Text>
              </View>
              <Text style={styles.subjectStatText}>
                {stat.averageScore !== null
                  ? `平均${stat.averageScore}点、`
                  : ''}
                {stat.totalCount}件
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    fontWeight: 600,
    color: '#1e3a8a',
  },
  badge: {
    backgroundColor: '#bfdbfe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    fontWeight: 400,
    color: '#1d4ed8',
  },
  subjectStatsContainer: {
    marginTop: 16,
    marginBottom: 16,
    gap: 10,
  },
  subjectStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subjectChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
  },
  subjectStatText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'Nunito-Regular',
  },
});
