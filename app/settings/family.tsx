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

const AVATAR_COLORS = [
  '#4A90E2', '#E74C3C', '#27AE60', '#F39C12', '#8E44AD',
  '#1ABC9C', '#E67E22', '#2980B9', '#C0392B', '#16A085',
];

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function getInitial(name: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0);
}

export default function FamilyScreen() {
  const headerTop = useHeaderTop(true);
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
          {loading ? (
            <ActivityIndicator size="large" color="#4A90E2" style={{ paddingVertical: 40 }} />
          ) : members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
              <Text style={styles.emptyText}>家族メンバーが見つかりません</Text>
            </View>
          ) : (
            <>
              <Text style={styles.countLabel}>{members.length}人のメンバー</Text>

              {members.map((member, index) => {
                const displayName = member.display_name?.trim() || '未設定';
                const isSelf = member.user_id === user?.id;
                const isOwner = member.role === 'owner';
                const avatarColor = getAvatarColor(index);

                return (
                  <View
                    key={member.user_id}
                    style={[styles.memberCard, isSelf && styles.memberCardSelf]}
                  >
                    <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                      <Text style={styles.avatarText}>{getInitial(member.display_name)}</Text>
                    </View>

                    <View style={styles.memberInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {displayName}
                        </Text>
                        {isSelf && (
                          <View style={styles.selfBadge}>
                            <Text style={styles.selfBadgeText}>あなた</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.roleRow}>
                        {isOwner ? (
                          <View style={styles.ownerBadge}>
                            <Text style={styles.ownerBadgeText}>👑 管理者</Text>
                          </View>
                        ) : (
                          <View style={styles.memberBadge}>
                            <Text style={styles.memberBadgeText}>メンバー</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  countLabel: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#999',
    marginBottom: 12,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#999',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.06)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  memberCardSelf: {
    borderWidth: 1.5,
    borderColor: '#4A90E2',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    color: '#1A1A1A',
    flexShrink: 1,
  },
  selfBadge: {
    backgroundColor: '#EBF5FF',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  selfBadgeText: {
    fontSize: 10,
    fontFamily: 'Nunito-Bold',
    color: '#4A90E2',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerBadge: {
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontFamily: 'Nunito-SemiBold',
    color: '#D97706',
  },
  memberBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  memberBadgeText: {
    fontSize: 11,
    fontFamily: 'Nunito-SemiBold',
    color: '#9CA3AF',
  },
});
