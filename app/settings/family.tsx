import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, useHeaderTop } from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { error as logError } from '@/lib/logger';

interface FamilyMember {
  user_id: string;
  role: 'owner' | 'member';
  display_name: string | null;
  created_at: string;
}

export default function FamilyScreen() {
  const headerTop = useHeaderTop();
  const { user, familyId, isFamilyReady } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!isFamilyReady || !familyId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('family_members')
      .select('user_id, role, display_name, created_at')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });

    if (error) {
      logError('[Family] メンバー取得エラー');
      setMembers([]);
    } else {
      setMembers(
        (data ?? []).map((m) => ({
          user_id: m.user_id as string,
          role: m.role as 'owner' | 'member',
          display_name: (m.display_name as string | null) ?? null,
          created_at: m.created_at as string,
        }))
      );
    }
    setLoading(false);
  }, [familyId, isFamilyReady]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={styles.container}>
        <AppHeader showBack showSettings={false} showChildSwitcher={false} title="家族メンバー" safeTopByParent />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerTop + 4 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {loading ? (
              <ActivityIndicator size="small" color="#4A90E2" style={{ paddingVertical: 24 }} />
            ) : members.length === 0 ? (
              <Text style={styles.emptyText}>家族メンバーが見つかりません</Text>
            ) : (
              members.map((member) => {
                const displayName = member.display_name?.trim() || '未設定';
                const isSelf = member.user_id === user?.id;
                const isOwner = member.role === 'owner';

                return (
                  <View
                    key={member.user_id}
                    style={[styles.memberRow, member !== members[members.length - 1] && styles.memberRowBorder]}
                  >
                    <Text style={styles.memberName}>{displayName}</Text>
                    <View style={styles.badgeContainer}>
                      {isOwner ? (
                        <View style={styles.ownerBadge}>
                          <Text style={styles.ownerBadgeText}>管理者</Text>
                        </View>
                      ) : (
                        <View style={styles.memberBadge}>
                          <Text style={styles.memberBadgeText}>メンバー</Text>
                        </View>
                      )}
                      {isSelf && (
                        <View style={styles.selfBadge}>
                          <Text style={styles.selfBadgeText}>あなた</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingBlock: 8,
    paddingInline: 16,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBlock: 14,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  memberName: {
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
    flexShrink: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ownerBadge: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    paddingBlock: 2,
    paddingInline: 8,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontFamily: 'Nunito-Bold',
    color: '#DC2626',
  },
  memberBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingBlock: 2,
    paddingInline: 8,
  },
  memberBadgeText: {
    fontSize: 11,
    fontFamily: 'Nunito-SemiBold',
    color: '#6B7280',
  },
  selfBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingBlock: 2,
    paddingInline: 8,
  },
  selfBadgeText: {
    fontSize: 11,
    fontFamily: 'Nunito-Bold',
    color: '#DC2626',
  },
});
