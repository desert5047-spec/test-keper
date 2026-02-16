import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { usePathname, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTrackLastAuthProvider } from '@/hooks/useTrackLastAuthProvider';
import { clearLastAuthProvider, saveLastAuthProvider } from '@/lib/auth/lastProvider';
import { getHandlingAuthCallback, isBootHold } from '@/lib/authCallbackState';
import {
  appendLog,
  setDebugAuthEvent,
  setDebugInitializing,
  setDebugWatchdogFired,
} from '@/lib/debugLog';
import { log, warn, error as logError } from '@/lib/logger';

const debugLog = log;

/** 無効なリフレッシュトークンによるエラーかどうかを判定する */
function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const msg = (error as { message?: string })?.message ?? '';
  const name = (error as { name?: string })?.name ?? '';
  return (
    name === 'AuthApiError' ||
    msg.includes('Refresh Token') ||
    msg.includes('refresh_token') ||
    msg.includes('Refresh Token Not Found') ||
    msg.includes('Invalid Refresh Token')
  );
}

const AUTH_CONTEXT_ROUTING_ENABLED = false;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authLoading: boolean;
  initializing: boolean;
  sessionUserId: string | null;
  familyId: string | null;
  isFamilyReady: boolean;
  familyDisplayName: string | null;
  refreshFamilyDisplayName: () => Promise<void>;
  isSetupReady: boolean;
  needsDisplayName: boolean;
  needsChildSetup: boolean;
  isConsentReady: boolean;
  needsConsent: boolean;
  refreshSetupStatus: () => Promise<void>;
  saveConsent: (consent: { agreedTerms: boolean; agreedPrivacy: boolean }) => Promise<void>;
  setActiveFamilyId: (familyId: string | null) => void;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ data: { session: Session | null } | null; error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    consent?: { agreedTerms: boolean; agreedPrivacy: boolean }
  ) => Promise<{ error: Error | null; status: 'existing' | 'email_sent' | 'signed_in' | 'error' }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  authLoading: true,
  initializing: true,
  sessionUserId: null,
  familyId: null,
  isFamilyReady: false,
  familyDisplayName: null,
  refreshFamilyDisplayName: async () => {},
  isSetupReady: false,
  needsDisplayName: false,
  needsChildSetup: false,
  isConsentReady: false,
  needsConsent: false,
  refreshSetupStatus: async () => {},
  saveConsent: async () => {},
  setActiveFamilyId: () => {},
  signIn: async () => ({ data: null, error: null }),
  signUp: async () => ({ error: null, status: 'error' }),
  signInWithGoogle: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  debugLog('[AuthProvider] 初期化開始', { platform: Platform.OS });
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isFamilyReady, setIsFamilyReady] = useState(false);
  const [familyDisplayName, setFamilyDisplayName] = useState<string | null>(null);
  const [isSetupReady, setIsSetupReady] = useState(false);
  const [needsDisplayName, setNeedsDisplayName] = useState(false);
  const [needsChildSetup, setNeedsChildSetup] = useState(false);
  const [isConsentReady, setIsConsentReady] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const ensureFamilyInFlightRef = useRef(false);
  const ensuredUserIdRef = useRef<string | null>(null);
  const familyEnsureRetryRef = useRef(0);
  const familyEnsureRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cachedFamilyIdAppliedRef = useRef(false);
  const refreshSetupCallRef = useRef(0);
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const familyIdCacheKey = (userId: string) => `familyId:${userId}`;
  const pendingInviteNavigationRef = useRef(false);
  const pendingInviteKey = 'pendingInviteToken';
  const pendingConsentKey = 'pendingConsent';
  const shouldHoldAuthRedirect = () =>
    getHandlingAuthCallback() || isBootHold() || pathname?.includes('auth-callback') === true;

  const clearInitTimer = () => {
    if (initTimerRef.current) {
      clearTimeout(initTimerRef.current);
      initTimerRef.current = null;
    }
  };

  const markAuthReady = () => {
    clearInitTimer();
    setLoading(false);
    setAuthLoading(false);
  };
  const extractInviteTokenFromUrl = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('token');
      return token ?? null;
    }
    try {
      const initialUrl = await Linking.getInitialURL();
      if (!initialUrl) return null;
      const parsed = Linking.parse(initialUrl);
      return (parsed.queryParams?.token as string) || null;
    } catch (error) {
      warn('[AuthContext] 招待トークンURL解析失敗');
      return null;
    }
  };

  const extractConsentFromMetadata = (currentUser: User) => {
    const meta = (currentUser.user_metadata ?? {}) as Record<string, unknown>;
    const agreedTerms =
      meta.agreed_terms === true || meta.agreed_terms === 'true';
    const agreedPrivacy =
      meta.agreed_privacy === true || meta.agreed_privacy === 'true';
    const agreedAt =
      typeof meta.agreed_at === 'string' ? meta.agreed_at : null;

    return { agreedTerms, agreedPrivacy, agreedAt };
  };

  const upsertProfileConsent = useCallback(
    async (
      userId: string,
      consent: { agreedTerms: boolean; agreedPrivacy: boolean; agreedAt?: string | null }
    ) => {
      const now = new Date().toISOString();
      const agreedAt = consent.agreedAt ?? now;
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        log('[AUTH][PRE_UPSERT] hasSession=' + String(!!session));
        log('[AUTH][PRE_UPSERT] hasAccessToken=' + String(!!session?.access_token));
        log('[AUTH][PRE_UPSERT] userId=' + String(session?.user?.id ?? ''));
        if (!session) {
          return;
        }
      } catch (error) {
        warn('[AUTH][PRE_UPSERT] getSession failed');
        return;
      }
      const { error } = await supabase.from('profiles').upsert(
        {
          user_id: userId,
          agreed_terms: consent.agreedTerms,
          agreed_privacy: consent.agreedPrivacy,
          agreed_at: agreedAt,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        warn('[AuthContext] profiles upsert 失敗');
        if ((error as { status?: number })?.status === 401) {
          log('[AUTH][UPSERT_FAIL]', error.status, error.message);
        }
      }
    },
    []
  );

  const saveConsent = useCallback(
    async (consent: { agreedTerms: boolean; agreedPrivacy: boolean }) => {
      if (!user?.id) return;
      const agreedAt = new Date().toISOString();
      try {
        await supabase.auth.updateUser({
          data: {
            agreed_terms: consent.agreedTerms,
            agreed_privacy: consent.agreedPrivacy,
            agreed_at: agreedAt,
          },
        });
      } catch (error) {
        warn('[AuthContext] user_metadata 更新失敗');
      }

      await upsertProfileConsent(user.id, {
        agreedTerms: consent.agreedTerms,
        agreedPrivacy: consent.agreedPrivacy,
        agreedAt,
      });

      setNeedsConsent(false);
      setIsConsentReady(true);
    },
    [user?.id, upsertProfileConsent]
  );

  const ensureProfileConsent = useCallback(
    async (currentUser: User) => {
      const metaConsent = extractConsentFromMetadata(currentUser);

      let pendingConsent: { agreedTerms: boolean; agreedPrivacy: boolean; agreedAt: string | null } | null = null;
      try {
        const stored = await AsyncStorage.getItem(pendingConsentKey);
        if (stored) {
          const parsed = JSON.parse(stored) as {
            agreedTerms?: boolean;
            agreedPrivacy?: boolean;
            agreedAt?: string;
            email?: string | null;
            userId?: string | null;
          };
          const emailMatches =
            parsed.email && currentUser.email
              ? parsed.email === currentUser.email
              : false;
          const userMatches =
            parsed.userId ? parsed.userId === currentUser.id : false;
          const isRecent =
            parsed.agreedAt
              ? Date.now() - new Date(parsed.agreedAt).getTime() < 30 * 60 * 1000
              : false;
          if (emailMatches || userMatches || isRecent) {
            pendingConsent = {
              agreedTerms: !!parsed.agreedTerms,
              agreedPrivacy: !!parsed.agreedPrivacy,
              agreedAt: parsed.agreedAt ?? null,
            };
            await AsyncStorage.removeItem(pendingConsentKey);
          }
        }
      } catch (error) {
        warn('[AuthContext] pendingConsent 読み込み失敗');
      }

      if (!metaConsent.agreedTerms && !metaConsent.agreedPrivacy && pendingConsent) {
        try {
          await supabase.auth.updateUser({
            data: {
              agreed_terms: pendingConsent.agreedTerms,
              agreed_privacy: pendingConsent.agreedPrivacy,
              agreed_at: pendingConsent.agreedAt ?? new Date().toISOString(),
            },
          });
          metaConsent.agreedTerms = pendingConsent.agreedTerms;
          metaConsent.agreedPrivacy = pendingConsent.agreedPrivacy;
          metaConsent.agreedAt = pendingConsent.agreedAt ?? new Date().toISOString();
        } catch (error) {
          warn('[AuthContext] user_metadata 更新失敗');
        }
      }

      const hasMetaConsent =
        metaConsent.agreedTerms || metaConsent.agreedPrivacy || !!metaConsent.agreedAt;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, agreed_terms, agreed_privacy, agreed_at')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        warn('[AuthContext] profiles 取得失敗');
        setIsConsentReady(true);
        return;
      }

      if (!profile) {
        if (!hasMetaConsent) {
          setNeedsConsent(true);
          setIsConsentReady(true);
          return;
        }
        await upsertProfileConsent(currentUser.id, {
          agreedTerms: metaConsent.agreedTerms,
          agreedPrivacy: metaConsent.agreedPrivacy,
          agreedAt: metaConsent.agreedAt,
        });
        setNeedsConsent(false);
        setIsConsentReady(true);
        return;
      }

      const needsAgreementBackfill =
        profile.agreed_terms === null ||
        profile.agreed_privacy === null ||
        (profile.agreed_at === null && metaConsent.agreedAt);

      if (needsAgreementBackfill && hasMetaConsent) {
        await supabase
          .from('profiles')
          .update({
            agreed_terms: profile.agreed_terms ?? metaConsent.agreedTerms,
            agreed_privacy: profile.agreed_privacy ?? metaConsent.agreedPrivacy,
            agreed_at: profile.agreed_at ?? metaConsent.agreedAt,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', currentUser.id);
      }

      const isMissingConsent =
        profile.agreed_terms !== true || profile.agreed_privacy !== true;
      setNeedsConsent(isMissingConsent);
      setIsConsentReady(true);
    },
    [upsertProfileConsent]
  );
  
  // 前回のログイン手段を追跡
  useTrackLastAuthProvider();
  
  debugLog('[AuthProvider] 状態初期化完了', { 
    hasRouter: !!router, 
    segmentsCount: segments.length,
    platform: Platform.OS 
  });

  const ensureFamilyForUser = useCallback(async (userId: string) => {
    debugLog('[AuthContext] ensureFamilyForUser 開始', { platform: Platform.OS });
    try {
      const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`${label} timeout`)), ms);
        });
        return Promise.race([promise, timeoutPromise]);
      };
      const isTimeoutError = (error: unknown) =>
        error instanceof Error && error.message.includes('timeout');

      // RLSやネットワークの影響を受けにくいRPCで先に取得を試す
      try {
        const { data: rpcFamilyId, error: rpcError } = await withTimeout(
          supabase.rpc('get_my_family_id'),
          8000,
          'get_my_family_id'
        ) as { data: string | null; error: any };
        if (rpcError) {
          warn('[AuthContext] get_my_family_id RPCエラー');
        } else if (rpcFamilyId) {
          debugLog('[AuthContext] get_my_family_id RPC成功', { platform: Platform.OS });
          return rpcFamilyId;
        }
      } catch (rpcException: any) {
        if (isTimeoutError(rpcException)) {
          warn('[AuthContext] get_my_family_id RPCタイムアウト');
        } else {
          warn('[AuthContext] get_my_family_id RPC例外');
        }
      }

      const ensureMemberForFamily = async (targetFamilyId: string) => {
        debugLog('[AuthContext] ensureMemberForFamily 開始', { platform: Platform.OS });
        let insertResult: { error: any } | null = null;
        try {
          insertResult = await withTimeout(
            supabase
              .from('family_members')
              .insert({
                family_id: targetFamilyId,
                user_id: userId,
                role: 'owner',
              }),
            12000,
            'family_members insert'
          ) as { error: any };
        } catch (insertError: any) {
          if (isTimeoutError(insertError)) {
            warn('[AuthContext] ensureMemberForFamily タイムアウト');
            return false;
          }
          logError('[AuthContext] ensureMemberForFamily 例外');
          return false;
        }

        const { error } = insertResult ?? { error: null };

        if (error) {
          if ((error as any)?.code !== '23505') {
            logError('[AuthContext] family_members 作成エラー');
          } else {
            debugLog('[AuthContext] family_members 既に存在（重複エラー無視）');
          }
          const { data: retryMembership, error: retryError } = await withTimeout(
            supabase
              .from('family_members')
              .select('family_id')
              .eq('user_id', userId)
              .eq('family_id', targetFamilyId)
              .limit(1)
              .maybeSingle(),
            12000,
            'family_members retry query'
          ) as { data: any; error: any };
          if (!retryError && retryMembership?.family_id) {
            debugLog('[AuthContext] ensureMemberForFamily 成功（リトライ後）');
            return true;
          }
          if (retryError) {
            logError('[AuthContext] ensureMemberForFamily リトライエラー');
          }
          return false;
        }

        debugLog('[AuthContext] ensureMemberForFamily 成功');
        return true;
      };

      debugLog('[AuthContext] 既存のfamily（owner）を検索中...', { platform: Platform.OS });
      try {
        const { data: existingOwnerFamily, error: existingOwnerFamilyError } = await withTimeout(
          supabase
            .from('families')
            .select('id')
            .eq('owner_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          12000,
          'families owner query'
        ) as { data: any; error: any };

        if (existingOwnerFamilyError) {
          logError('[AuthContext] families(owner) 検索エラー');
        } else {
          debugLog('[AuthContext] families(owner) クエリ成功', {
            hasExistingFamily: !!existingOwnerFamily?.id,
            platform: Platform.OS,
          });
        }

        if (!existingOwnerFamilyError && existingOwnerFamily?.id) {
          debugLog('[AuthContext] 既存のfamily（owner）を発見', { platform: Platform.OS });
          const memberOk = await ensureMemberForFamily(existingOwnerFamily.id as string);
          if (memberOk) {
            return existingOwnerFamily.id as string;
          }
          warn('[AuthContext] 既存family（owner）へのメンバー追加失敗');
        }
      } catch (ownerFamilyQueryError: any) {
        if (isTimeoutError(ownerFamilyQueryError)) {
          warn('[AuthContext] families(owner) クエリタイムアウト');
        } else {
          logError('[AuthContext] families(owner) クエリ例外');
        }
      }

      debugLog('[AuthContext] family_members から既存メンバーシップを検索中...', { platform: Platform.OS });
      try {
        const { data: membership, error: membershipError } = await withTimeout(
          supabase
            .from('family_members')
            .select('family_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle(),
          12000,
          'family_members query'
        ) as { data: any; error: any };

        if (membershipError) {
          logError('[AuthContext] family_members 取得エラー');
          // RLSエラーの場合は、新しいfamilyを作成する処理に進む
          if ((membershipError as any)?.code === '42P17' || membershipError?.message?.includes('recursion')) {
            warn('[AuthContext] RLS再帰エラー検出、新しいfamily作成を試みます');
            // エラーを無視して続行（新しいfamilyを作成する）
          } else {
            return null;
          }
        } else {
          debugLog('[AuthContext] family_members クエリ成功', { 
            hasMembership: !!membership?.family_id,
            platform: Platform.OS 
          });
        }

        if (membership?.family_id) {
          debugLog('[AuthContext] 既存のメンバーシップを発見', { platform: Platform.OS });
          return membership.family_id as string;
        }
      } catch (membershipQueryError: any) {
        if (isTimeoutError(membershipQueryError)) {
          warn('[AuthContext] family_members クエリタイムアウト');
        } else {
        logError('[AuthContext] family_members クエリ例外');
        // RLSエラーの場合は、新しいfamilyを作成する処理に進む
        if (membershipQueryError?.code === '42P17' || membershipQueryError?.message?.includes('recursion')) {
          warn('[AuthContext] RLS再帰エラー検出（例外）、新しいfamily作成を試みます');
          // エラーを無視して続行（新しいfamilyを作成する）
        } else {
          return null;
        }
        }
      }

      debugLog('[AuthContext] 新しいfamilyを作成中...', { platform: Platform.OS });
      try {
        const { data: family, error: familyError } = await withTimeout(
          supabase
            .from('families')
            .insert({ owner_id: userId })
            .select('id')
            .single(),
          12000,
          'families insert'
        ) as { data: any; error: any };

        if (familyError || !family?.id) {
          logError('[AuthContext] families 作成エラー');

          debugLog('[AuthContext] 最終リトライ: family_members から検索...', { platform: Platform.OS });
          try {
            const { data: retryMembership, error: retryError } = await withTimeout(
              supabase
                .from('family_members')
                .select('family_id')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle(),
              12000,
              'family_members final retry'
            ) as { data: any; error: any };

            if (!retryError && retryMembership?.family_id) {
              debugLog('[AuthContext] 最終リトライでメンバーシップを発見', { platform: Platform.OS });
              return retryMembership.family_id as string;
            }
            if (retryError) {
              logError('[AuthContext] 最終リトライエラー');
            }
          } catch (retryException: any) {
            logError('[AuthContext] 最終リトライ例外');
          }

          return null;
        }

        debugLog('[AuthContext] 新しいfamilyを作成成功', { platform: Platform.OS });
        const memberOk = await ensureMemberForFamily(family.id);
        if (!memberOk) {
          logError('[AuthContext] 新しいfamilyへのメンバー追加失敗');
          return null;
        }

        debugLog('[AuthContext] ensureFamilyForUser 成功', { platform: Platform.OS });
        return family.id as string;
      } catch (familyCreateError: any) {
        logError('[AuthContext] families 作成例外');
        return null;
      }
    } catch (error) {
      logError('[AuthContext] family ensure 例外');
      return null;
    }
  }, []);

  const refreshFamilyDisplayName = useCallback(async () => {
    if (!user?.id || !isFamilyReady || !familyId) {
      setFamilyDisplayName(null);
      return;
    }

    const { data, error } = await supabase
      .from('family_members')
      .select('display_name')
      .eq('family_id', familyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      logError('[AuthContext] display_name 取得エラー');
      setFamilyDisplayName(null);
      return;
    }

    setFamilyDisplayName((data?.display_name as string | null) ?? null);
  }, [user?.id, isFamilyReady, familyId]);

  const refreshSetupStatus = useCallback(async () => {
    const callId = ++refreshSetupCallRef.current;
    if (!session?.user) {
      setIsSetupReady(false);
      setNeedsDisplayName(false);
      setNeedsChildSetup(false);
      return;
    }
    if (!user?.id || !isFamilyReady || !familyId) {
      setIsSetupReady(false);
      setNeedsDisplayName(false);
      setNeedsChildSetup(false);
      return;
    }

    setIsSetupReady(false);
    const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timeout`)), ms);
      });
      return Promise.race([promise, timeoutPromise]);
    };
    const getCachedChildId = async () => {
      try {
        return await AsyncStorage.getItem('@selected_child_id');
      } catch (error) {
        warn('[AuthContext] setup 判定: childId キャッシュ取得失敗');
        return null;
      }
    };

    debugLog('[AuthContext] setup 判定開始', { platform: Platform.OS, callId });
    let member: any = null;
    let memberError: any = null;
    let profileElapsedMs: number | null = null;
    let profileData: any = null;
    let profileError: any = null;
    try {
      const profileStart = Date.now();
      const memberResult = await withTimeout(
        supabase
          .from('family_members')
          .select('display_name')
          .eq('family_id', familyId)
          .eq('user_id', user.id)
          .maybeSingle(),
        12000,
        'setup display_name'
      ) as { data: any; error: any };
      profileElapsedMs = Date.now() - profileStart;
      member = memberResult?.data ?? null;
      memberError = memberResult?.error ?? null;
      profileData = memberResult?.data ?? null;
      profileError = memberResult?.error ?? null;
    } catch (error: any) {
      memberError = error;
      profileElapsedMs = profileElapsedMs ?? null;
      profileError = error;
    }

    if (memberError) {
      const isTimeout = memberError instanceof Error && memberError.message.includes('timeout');
      if (isTimeout) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          debugLog('[AuthContext][Session] getSession 結果 (before warn)', {
            callId,
            hasSession: !!currentSession,
            hasUser: !!currentSession?.user,
          });
        } catch (sessionError) {
          debugLog('[AuthContext][Session] getSession 例外 (before warn)', { callId });
        }
        debugLog('[AuthContext][Profiles] profiles 取得結果 (before warn)', {
          callId,
          elapsedMs: profileElapsedMs,
          hasData: !!profileData,
          hasError: !!profileError,
        });
        warn('[AuthContext] setup 判定: display_name タイムアウト');
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          debugLog('[AuthContext][Session] getSession 結果 (after warn)', {
            callId,
            hasSession: !!currentSession,
            hasUser: !!currentSession?.user,
          });
        } catch (sessionError) {
          debugLog('[AuthContext][Session] getSession 例外 (after warn)', { callId });
        }
        debugLog('[AuthContext][Profiles] profiles 取得結果 (after warn)', {
          callId,
          elapsedMs: profileElapsedMs,
          hasData: !!profileData,
          hasError: !!profileError,
        });
      } else {
        logError('[AuthContext] setup 判定: display_name 取得エラー');
      }
      setNeedsDisplayName(true);
      setNeedsChildSetup(true);
      setIsSetupReady(true);
      return;
    }

    const displayName = (member?.display_name as string | null) ?? null;
    setFamilyDisplayName(displayName);
    const hasMember = !!member;
    const needsName = !hasMember || !displayName || displayName.trim().length === 0;
    setNeedsDisplayName(needsName);

    let childCount: number | null = null;
    let childError: any = null;
    try {
      const childResult = await withTimeout(
        supabase
          .from('children')
          .select('id', { count: 'exact', head: true })
          .eq('family_id', familyId)
          .limit(1),
        12000,
        'setup children'
      ) as { count: number | null; error: any };
      childCount = childResult?.count ?? null;
      childError = childResult?.error ?? null;
    } catch (error: any) {
      childError = error;
    }

    if (childError) {
      const isTimeout = childError instanceof Error && childError.message.includes('timeout');
      if (isTimeout) {
        warn('[AuthContext] setup 判定: child タイムアウト');
        const cachedChildId = await getCachedChildId();
        if (cachedChildId) {
          warn('[AuthContext] setup 判定: キャッシュを信頼してホームへ');
          setNeedsChildSetup(false);
          setIsSetupReady(true);
          return;
        }
      } else {
        logError('[AuthContext] setup 判定: child 取得エラー');
      }
      setNeedsChildSetup(true);
      setIsSetupReady(true);
      return;
    }

    const needsChild = !childCount || childCount === 0;
    setNeedsChildSetup(needsChild);
    setIsSetupReady(true);
  }, [user?.id, isFamilyReady, familyId]);

  // 初期セットアップ状態を確認して適切な画面にリダイレクト
  // TODO: 家族招待機能は次フェーズで再開予定
  const ENABLE_INVITE_FEATURE = false;
  const navigateToPendingInvite = useCallback(async () => {
    if (!ENABLE_INVITE_FEATURE) {
      return false;
    }
    try {
      const token = await AsyncStorage.getItem(pendingInviteKey);
      if (!token) {
        pendingInviteNavigationRef.current = false;
        return false;
      }
      if (pendingInviteNavigationRef.current) {
        return false;
      }
      pendingInviteNavigationRef.current = true;
      router.replace(`/invite?token=${encodeURIComponent(token)}`);
      return true;
    } catch (error) {
      warn('[AuthContext] 招待トークン取得エラー');
      return false;
    }
  }, [router]);

  const checkAndRedirect = useCallback(async (currentUser: User) => {
    if (checkingOnboarding) {
      debugLog('[AuthContext] checkAndRedirect: 既にチェック中です');
      return;
    }
    if (!isFamilyReady || !familyId) {
      debugLog('[AuthContext] checkAndRedirect: familyId 未確定のため待機', {
        isFamilyReady,
      });
      return;
    }
    if (!isSetupReady) {
      debugLog('[AuthContext] checkAndRedirect: setup 判定中のため待機');
      await refreshSetupStatus();
      return;
    }
    const hasPendingInvite = await navigateToPendingInvite();
    if (hasPendingInvite) {
      return;
    }
    setCheckingOnboarding(true);

    try {
      const currentPath = segments.join('/');
      const isTabs = segments[0] === '(tabs)';
      const inAuthGroup = segments[0] === '(auth)';
      const isOnboarding = currentPath === 'onboarding';
      const isRegisterChild = currentPath === 'register-child';
      const isInvite = currentPath.startsWith('invite');
      const isConsent = currentPath === 'consent';

      if (isConsentReady && needsConsent) {
        if (!isConsent) {
          debugLog('[AuthContext] checkAndRedirect: 同意が必要、同意画面へ');
          router.replace('/consent');
        }
        setCheckingOnboarding(false);
        return;
      }

      if (needsDisplayName || needsChildSetup) {
        if (!isOnboarding && !isInvite && !isRegisterChild) {
          debugLog('[AuthContext] checkAndRedirect: 初期セットアップが必要、オンボーディングへ');
          router.replace('/onboarding');
        }
        setCheckingOnboarding(false);
        return;
      }

      if (isRegisterChild) {
        debugLog('[AuthContext] checkAndRedirect: セットアップ完了、オンボーディングへ');
        router.replace('/onboarding');
      } else if (inAuthGroup) {
        debugLog('[AuthContext] checkAndRedirect: セットアップ完了、タブページへ');
        router.replace('/(tabs)');
      } else if (isOnboarding) {
        debugLog('[AuthContext] checkAndRedirect: セットアップ完了、オンボーディングに滞在');
      } else if (isConsent) {
        debugLog('[AuthContext] checkAndRedirect: 同意済み、次の画面へ');
        router.replace('/onboarding');
      } else if (!isTabs) {
        debugLog('[AuthContext] checkAndRedirect: 既に適切なページにいます');
      }
    } catch (error) {
      logError('[AuthContext] checkAndRedirect: エラー');
    } finally {
      setCheckingOnboarding(false);
    }
  }, [checkingOnboarding, router, segments, familyId, isFamilyReady, isSetupReady, needsDisplayName, needsChildSetup, isConsentReady, needsConsent, refreshSetupStatus, navigateToPendingInvite]);

  const setActiveFamilyId = useCallback((nextFamilyId: string | null) => {
    setFamilyId(nextFamilyId);
    setIsFamilyReady(!!nextFamilyId);
    setFamilyDisplayName(null);
    setNeedsDisplayName(false);
    setNeedsChildSetup(false);
    setIsSetupReady(false);
  }, []);

  // checkAndRedirectの最新の参照を保持するためのref
  const checkAndRedirectRef = useRef(checkAndRedirect);
  useEffect(() => {
    checkAndRedirectRef.current = checkAndRedirect;
  }, [checkAndRedirect]);

  useEffect(() => {
    setInitializing(true);
    setAuthLoading(true);
    setDebugInitializing(true);
    setDebugWatchdogFired(false);
    clearInitTimer();
    initTimerRef.current = setTimeout(() => {
      warn('[AuthContext] Auth init timeout (forced unlock)');
      appendLog('Auth init timeout (forced unlock)');
      setDebugWatchdogFired(true);
      setDebugInitializing(false);
      setInitializing(false);
      markAuthReady();
    }, 8000);

    const initAuthSession = async () => {
      log('[AuthContext][Session] getSession start');
      appendLog('getSession start');
      debugLog('[AuthContext][Session] getSession 開始', { platform: Platform.OS });
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        debugLog('[AuthContext][Session] getSession 結果', {
          hasSession: !!session,
          hasUser: !!session?.user,
          hasError: !!error,
          platform: Platform.OS,
        });
        if (error) {
          logError('[AuthContext] セッション取得エラー');
          appendLog('getSession error');
          // リフレッシュトークンエラーの場合は、セッションをクリアしてストレージもクリア
          if (isInvalidRefreshTokenError(error)) {
            warn('[AuthContext] リフレッシュトークンエラーを検出、セッションをクリアします');
            setSession(null);
            setUser(null);
            setFamilyId(null);
            setIsFamilyReady(false);
            ensuredUserIdRef.current = null;
            ensureFamilyInFlightRef.current = false;
            supabase.auth.signOut().catch(() => {});
          }
          markAuthReady();
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        markAuthReady();
        appendLog(`getSession done hasUser=${!!session?.user}`);

        if (session?.user) {
          const profileStart = Date.now();
          debugLog('[AuthContext][Profiles] profiles 取得開始');
          try {
            const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error(`${label} timeout`)), ms);
              });
              return Promise.race([promise, timeoutPromise]);
            };
            const { data, error: profileError } = await withTimeout(
              supabase
                .from('profiles')
                .select('user_id')
                .eq('user_id', session.user.id)
                .maybeSingle(),
              5000,
              'profiles'
            ) as { data: any; error: any };
            const elapsedMs = Date.now() - profileStart;
            debugLog('[AuthContext][Profiles] profiles 取得完了', {
              elapsedMs,
              hasData: !!data,
              hasError: !!profileError,
            });
          } catch (profileError: any) {
            const elapsedMs = Date.now() - profileStart;
            if (profileError instanceof Error && profileError.message.includes('timeout')) {
              warn('[AuthContext][Profiles] profiles タイムアウト', { elapsedMs });
            } else {
              warn('[AuthContext][Profiles] profiles 取得エラー', { elapsedMs });
            }
          }
        }
      } catch (error) {
        logError('[AuthContext] セッション取得例外');
        appendLog('getSession exception');
        // リフレッシュトークンエラー（Invalid Refresh Token 等）の場合はセッションをクリアしストレージも削除
        if (isInvalidRefreshTokenError(error)) {
          warn('[AuthContext] リフレッシュトークンエラー例外を検出、セッションをクリアします');
          setSession(null);
          setUser(null);
          setFamilyId(null);
          setIsFamilyReady(false);
          ensuredUserIdRef.current = null;
          ensureFamilyInFlightRef.current = false;
          supabase.auth.signOut().catch(() => {});
        }
        markAuthReady();
      } finally {
        log('[AuthContext][Session] getSession done');
        setDebugInitializing(false);
        setInitializing(false);
        setAuthLoading(false);
      }
    };

    // Expo Go 等で getSession が別経路で失敗した場合に備え、未処理の Promise 拒否を捕捉
    const g = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : {};
    const rejectionHandler = (event: { reason?: unknown; preventDefault?: () => void }) => {
      const reason = event?.reason;
      if (isInvalidRefreshTokenError(reason)) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        warn('[AuthContext] 未処理のリフレッシュトークンエラーを検出、セッションをクリアします');
        setSession(null);
        setUser(null);
        setFamilyId(null);
        setIsFamilyReady(false);
        ensuredUserIdRef.current = null;
        ensureFamilyInFlightRef.current = false;
        supabase.auth.signOut().catch(() => {});
        markAuthReady();
        setInitializing(false);
        setAuthLoading(false);
      }
    };
    if (typeof (g as any).addEventListener === 'function') {
      (g as any).addEventListener('unhandledrejection', rejectionHandler);
    }

    initAuthSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      log('[AuthContext][onAuthStateChange]', event);
      appendLog(`onAuthStateChange ${event}`);
      setDebugAuthEvent(event);
      debugLog('[AuthContext] 認証状態変更:', { event, platform: Platform.OS });
      setInitializing(false);
      setAuthLoading(false);
      // トークンリフレッシュエラーを処理
      if (event === 'TOKEN_REFRESHED') {
        debugLog('[AuthContext] トークンがリフレッシュされました', { platform: Platform.OS });
        setSession(session);
        setUser(session?.user ?? null);
        markAuthReady();
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        debugLog('[AuthContext] PASSWORD_RECOVERY 検出', { platform: Platform.OS });
        markAuthReady();
        if (AUTH_CONTEXT_ROUTING_ENABLED) {
          router.replace('/(auth)/reset-password');
        }
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // INITIAL_SESSIONイベントの場合は、getSession()の結果を待つため、loadingをfalseにしない
      // 他のイベントの場合は、loadingをfalseにする
      if (event !== 'INITIAL_SESSION') {
        markAuthReady();
      }
      
      // SIGNED_INイベントの場合は、オンボーディング/子供登録チェックを実行
      if (event === 'SIGNED_IN' && session?.user) {
        debugLog('[AuthContext] ログイン検出、オンボーディングチェックを実行', { platform: Platform.OS });
        markAuthReady();
        await ensureProfileConsent(session.user);
        const hasPendingInvite = await navigateToPendingInvite();
        if (!hasPendingInvite && AUTH_CONTEXT_ROUTING_ENABLED) {
          // 少し遅延を入れて、segmentsが更新されるのを待つ
          setTimeout(() => {
            checkAndRedirectRef.current(session.user);
          }, 200);
        }
      }
      
      // SIGNED_OUTイベントの場合は、ログイン画面にリダイレクト
      if (event === 'SIGNED_OUT') {
        debugLog('[AuthContext] ログアウト検出、ログイン画面にリダイレクト', { platform: Platform.OS });
        markAuthReady();
        setFamilyId(null);
        setIsFamilyReady(false);
        ensuredUserIdRef.current = null;
        ensureFamilyInFlightRef.current = false;
        pendingInviteNavigationRef.current = false;
        if (shouldHoldAuthRedirect()) {
          debugLog('[AuthContext] 認証コールバック処理中のためリダイレクトを抑止', { platform: Platform.OS });
          return;
        }
        if (AUTH_CONTEXT_ROUTING_ENABLED) {
          // Androidでは、より確実にリダイレクトするため、少し長めの遅延を入れる
          const delay = Platform.OS === 'android' ? 300 : 100;
          setTimeout(() => {
            debugLog('[AuthContext] リダイレクト実行:', { platform: Platform.OS });
            router.replace('/(auth)/login');
          }, delay);
        }
      }
      
      // INITIAL_SESSIONイベントの場合は、getSession()の結果を待つ
      // getSession()が完了したら、loadingをfalseにする
      if (event === 'INITIAL_SESSION') {
        // getSession()の結果を待つ（既に実行されているが、念のため）
        // getSession()がリフレッシュトークンエラーで例外を投げる場合があるため .catch で処理
        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          markAuthReady();
          if (!currentSession?.user) {
            setFamilyId(null);
            setIsFamilyReady(false);
            setIsConsentReady(false);
            setNeedsConsent(false);
            if (shouldHoldAuthRedirect()) {
              debugLog('[AuthContext] 認証コールバック処理中のためログイン遷移を抑止', { platform: Platform.OS });
            }
          }
          debugLog('[AuthContext] INITIAL_SESSION処理完了:', { 
            hasUser: !!currentSession?.user,
            platform: Platform.OS 
          });
        }).catch((err) => {
          if (isInvalidRefreshTokenError(err)) {
            warn('[AuthContext] INITIAL_SESSION getSession でリフレッシュトークンエラー、セッションをクリアします');
            setSession(null);
            setUser(null);
            setFamilyId(null);
            setIsFamilyReady(false);
            ensuredUserIdRef.current = null;
            ensureFamilyInFlightRef.current = false;
            setIsConsentReady(false);
            setNeedsConsent(false);
            supabase.auth.signOut().catch(() => {});
          }
          markAuthReady();
        });
      }
    });

    const handleDeepLink = async ({ url }: { url: string }) => {
      if (!url || !url.includes('auth-callback')) {
        return;
      }
      debugLog('[AuthContext] 深いリンク受信', { hasUrl: !!url, platform: Platform.OS });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await ensureProfileConsent(session.user);
          setTimeout(() => {
            checkAndRedirectRef.current(session.user);
          }, 200);
        }
      } catch (error) {
        if (isInvalidRefreshTokenError(error)) {
          warn('[AuthContext] 深いリンク処理でリフレッシュトークンエラー、セッションをクリアします');
          setSession(null);
          setUser(null);
          setFamilyId(null);
          setIsFamilyReady(false);
          supabase.auth.signOut().catch(() => {});
        } else {
          warn('[AuthContext] 深いリンクの再取得に失敗');
        }
      }
    };

    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      clearInitTimer();
      subscription.unsubscribe();
      linkingSubscription.remove();
      if (typeof (g as any).removeEventListener === 'function') {
        (g as any).removeEventListener('unhandledrejection', rejectionHandler);
      }
      setInitializing(false);
      setDebugInitializing(false);
    };
  }, []);

  useEffect(() => {
    // TODO: 家族招待機能は次フェーズで再開予定
    const ENABLE_INVITE_FEATURE = false;
    if (!ENABLE_INVITE_FEATURE) {
      return;
    }
    const syncInviteTokenFromUrl = async () => {
      const token = await extractInviteTokenFromUrl();
      if (!token) return;
      const currentPath = segments.join('/');
      const isInvite = currentPath.startsWith('invite');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const reloadKey = `inviteReloaded:${token}`;
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          const url = `/invite?token=${encodeURIComponent(token)}`;
          window.location.replace(url);
          return;
        }
      }
      await AsyncStorage.setItem(pendingInviteKey, token);
      if (!isInvite) {
        router.replace(`/invite?token=${encodeURIComponent(token)}`);
      }
    };
    syncInviteTokenFromUrl();
  }, [router, segments]);

  useEffect(() => {
    if (!AUTH_CONTEXT_ROUTING_ENABLED) return;
    if (loading || checkingOnboarding) return;
    if (initializing) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOnboarding = segments[0] === 'onboarding';
    const isRegisterChild = segments[0] === 'register-child';
    const isTabs = segments[0] === '(tabs)';
    const isInvite = segments[0] === 'invite';

    const isPublicAuthRoute =
      pathname?.includes('auth-callback') === true ||
      pathname?.includes('forgot-password') === true ||
      pathname?.includes('reset-password') === true;

    // 未ログインの場合
    if (!session) {
      // auth-callback 処理中は最優先で抑止
      if (getHandlingAuthCallback()) return;

      // 起動直後の deep link 処理猶予
      if (isBootHold()) return;

      // public auth routes は抑止
      if (isPublicAuthRoute) return;

      router.replace('/(auth)/login');
      return;
    }

    // ログイン済みの場合は常にセットアップ判定を実行
    if (user) {
      checkAndRedirect(user);
    }
  }, [user, segments, loading, checkingOnboarding, checkAndRedirect]);

  useEffect(() => {
    let cancelled = false;

    const loadCachedFamilyId = async (userId: string) => {
      try {
        const cachedFamilyId = await AsyncStorage.getItem(familyIdCacheKey(userId));
        if (!cancelled && cachedFamilyId) {
          setFamilyId(cachedFamilyId);
          setIsFamilyReady(true);
          debugLog('[AuthContext] familyId キャッシュを適用', { platform: Platform.OS });
        }
      } catch (error) {
        warn('[AuthContext] familyId キャッシュ取得失敗');
      }
    };

    const waitForSessionReady = async (attempts = 10, delayMs = 600) => {
      for (let i = 0; i < attempts; i += 1) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (isInvalidRefreshTokenError(error)) {
            warn('[AuthContext] waitForSessionReady でリフレッシュトークンエラー、セッションをクリアします');
            setSession(null);
            setUser(null);
            setFamilyId(null);
            setIsFamilyReady(false);
            supabase.auth.signOut().catch(() => {});
            return false;
          }
          if (session?.user) return true;
        } catch (err) {
          if (isInvalidRefreshTokenError(err)) {
            warn('[AuthContext] waitForSessionReady でリフレッシュトークンエラー、セッションをクリアします');
            setSession(null);
            setUser(null);
            setFamilyId(null);
            setIsFamilyReady(false);
            supabase.auth.signOut().catch(() => {});
            return false;
          }
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      return false;
    };

    const runEnsureFamily = async () => {
      if (!user?.id) {
      debugLog('[AuthContext] ユーザーIDなし、family処理をスキップ', { platform: Platform.OS });
      setFamilyId(null);
      setIsFamilyReady(false);
      setFamilyDisplayName(null);
      setIsSetupReady(false);
      setNeedsDisplayName(false);
      setNeedsChildSetup(false);
      setIsConsentReady(false);
      setNeedsConsent(false);
      familyEnsureRetryRef.current = 0;
      cachedFamilyIdAppliedRef.current = false;
      if (familyEnsureRetryTimerRef.current) {
        clearTimeout(familyEnsureRetryTimerRef.current);
        familyEnsureRetryTimerRef.current = null;
      }
      return;
    }

      if (!cachedFamilyIdAppliedRef.current) {
        cachedFamilyIdAppliedRef.current = true;
        await loadCachedFamilyId(user.id);
      }

      const hasSession = await waitForSessionReady();
      if (!hasSession) {
      warn('[AuthContext] セッション未確定のためfamily処理を延期');
        return;
      }

      if (ensuredUserIdRef.current !== user.id) {
        familyEnsureRetryRef.current = 0;
        if (familyEnsureRetryTimerRef.current) {
          clearTimeout(familyEnsureRetryTimerRef.current);
          familyEnsureRetryTimerRef.current = null;
        }
      }
      if (ensureFamilyInFlightRef.current) {
      debugLog('[AuthContext] ensureFamilyForUser 既に実行中、スキップ', { platform: Platform.OS });
        return;
      }
      if (ensuredUserIdRef.current === user.id) {
      debugLog('[AuthContext] 既に処理済みのユーザー、スキップ', { platform: Platform.OS });
        return;
      }

      debugLog('[AuthContext] ensureFamilyForUser 実行開始', { platform: Platform.OS });
      ensureFamilyInFlightRef.current = true;
      setIsFamilyReady(false);
      ensureFamilyForUser(user.id)
      .then((id) => {
        debugLog('[AuthContext] ensureFamilyForUser 完了', { platform: Platform.OS });
        if (id) {
          setFamilyId(id);
          ensuredUserIdRef.current = user.id;
          setIsFamilyReady(true);
          familyEnsureRetryRef.current = 0;
          if (familyEnsureRetryTimerRef.current) {
            clearTimeout(familyEnsureRetryTimerRef.current);
            familyEnsureRetryTimerRef.current = null;
          }
          AsyncStorage.setItem(familyIdCacheKey(user.id), id).catch((error) => {
            warn('[AuthContext] familyId キャッシュ保存失敗');
          });
          debugLog('[AuthContext] familyId設定完了', { platform: Platform.OS });
        } else {
          warn('[AuthContext] ensureFamilyForUser 失敗、familyIdがnull');
          ensuredUserIdRef.current = null;
          setIsFamilyReady(false);
          if (familyEnsureRetryRef.current < 3) {
            familyEnsureRetryRef.current += 1;
            const delay = 1500 * familyEnsureRetryRef.current;
            if (familyEnsureRetryTimerRef.current) {
              clearTimeout(familyEnsureRetryTimerRef.current);
            }
            familyEnsureRetryTimerRef.current = setTimeout(() => {
              debugLog('[AuthContext] ensureFamilyForUser 再試行開始', {
                attempt: familyEnsureRetryRef.current,
                delayMs: delay,
                platform: Platform.OS,
              });
              ensureFamilyInFlightRef.current = true;
              setIsFamilyReady(false);
              ensureFamilyForUser(user.id)
                .then((retryId) => {
                  debugLog('[AuthContext] ensureFamilyForUser 再試行完了', { platform: Platform.OS });
                  if (retryId) {
                    setFamilyId(retryId);
                    ensuredUserIdRef.current = user.id;
                    setIsFamilyReady(true);
                    familyEnsureRetryRef.current = 0;
                  } else {
                    warn('[AuthContext] ensureFamilyForUser 再試行失敗');
                    ensuredUserIdRef.current = null;
                    setIsFamilyReady(false);
                  }
                })
                .catch((retryError) => {
                  logError('[AuthContext] ensureFamilyForUser 再試行エラー');
                  ensuredUserIdRef.current = null;
                  setIsFamilyReady(false);
                })
                .finally(() => {
                  ensureFamilyInFlightRef.current = false;
                  debugLog('[AuthContext] ensureFamilyForUser 再試行処理完了（finally）', { platform: Platform.OS });
                });
            }, delay);
          }
        }
      })
      .catch((error) => {
        logError('[AuthContext] family ensure 実行エラー');
        ensuredUserIdRef.current = null;
        setIsFamilyReady(false);
      })
      .finally(() => {
        ensureFamilyInFlightRef.current = false;
        debugLog('[AuthContext] ensureFamilyForUser 処理完了（finally）', { platform: Platform.OS });
      });
    };

    runEnsureFamily();
    return () => {
      cancelled = true;
    };
  }, [user?.id, ensureFamilyForUser]);

  useEffect(() => {
    refreshFamilyDisplayName();
  }, [refreshFamilyDisplayName]);

  useEffect(() => {
    refreshSetupStatus();
  }, [refreshSetupStatus]);

  const signIn = async (email: string, password: string) => {
    debugLog('[AuthContext] signIn 開始', { platform: Platform.OS });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logError('[AuthContext] signIn エラー');
        return { data: null, error };
      }

      debugLog('[AuthContext] signIn 成功', { platform: Platform.OS });
      
      // メール認証でログインした場合は明示的に保存する
      await saveLastAuthProvider('email');
      
      // セッションが確立されるまで少し待つ
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { data: { session: data.session ?? null }, error: null };
    } catch (err: any) {
      logError('[AuthContext] signIn 例外');
      return { data: null, error: err instanceof Error ? err : new Error('ログイン中にエラーが発生しました') };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    consent?: { agreedTerms: boolean; agreedPrivacy: boolean }
  ) => {
    const agreedAt = consent ? new Date().toISOString() : undefined;
    log('[AuthContext] emailRedirectTo:', 'https://www.test-album.jp/auth/callback');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // メール確認のリダイレクトURLを固定
        emailRedirectTo: 'https://www.test-album.jp/auth/callback',
        data: consent
          ? {
              agreed_terms: consent.agreedTerms,
              agreed_privacy: consent.agreedPrivacy,
              agreed_at: agreedAt,
            }
          : undefined,
      },
    });

    log('[AuthContext][signUp] error:', error);
    log('[AuthContext][signUp] sessionExists:', !!data?.session);

    if (error) {
      const message = error.message || '登録に失敗しました。';
      const lower = message.toLowerCase();
      const isAlreadyRegistered =
        lower.includes('already') || lower.includes('registered');
      if (isAlreadyRegistered) {
        Alert.alert(
          'このメールは登録済みです',
          `${message}\n\nこのメールは登録済みです。ログインしてください。`
        );
      } else {
        Alert.alert('登録に失敗しました', message);
      }
      return { error, status: isAlreadyRegistered ? 'existing' : 'error' };
    }

    if (!data?.session) {
      const identitiesCount = data?.user?.identities?.length;
      log('[AuthContext][signUp] identitiesCount:', identitiesCount ?? 'undefined');
      const isExistingEmail = identitiesCount === 0 || identitiesCount === undefined;
      if (isExistingEmail) {
        Alert.alert(
          'このメールは登録済みです',
          'このメールは登録済みです。ログインしてください。'
        );
        return { error: null, status: 'existing' };
      }
      Alert.alert(
        '確認メールを送信しました',
        'メールのリンクから登録を完了してください。'
      );
      return { error: null, status: 'email_sent' };
    }

    if (data.user && consent) {
      await upsertProfileConsent(data.user.id, {
        agreedTerms: consent.agreedTerms,
        agreedPrivacy: consent.agreedPrivacy,
        agreedAt,
      });
    }

    router.replace('/(tabs)');
    return { error: null, status: 'signed_in' };
  };

  const signInWithGoogle = async () => {
    warn('[Google認証] 一時的に無効化しています');
    return { error: new Error('Google認証は一時的に無効化しています') };
  };

  const signOut = async () => {
    try {
      debugLog('[AuthContext] ログアウト開始');
      
      // まず、ローカルの状態をクリア
      setSession(null);
      setUser(null);
      setFamilyId(null);
      setIsFamilyReady(false);
      ensuredUserIdRef.current = null;
      ensureFamilyInFlightRef.current = false;
      
      // SupabaseのsignOutを試みる（エラーが発生しても続行）
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          warn('[AuthContext] Supabase signOutエラー（無視して続行）');
          // AuthSessionMissingError などのエラーは無視して続行
        } else {
          debugLog('[AuthContext] Supabase signOut成功');
        }
      } catch (signOutError: any) {
        // AuthSessionMissingError などのエラーは無視して続行
        warn('[AuthContext] Supabase signOut例外（無視して続行）');
      }
      
      // ストレージのクリア
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Web環境では、セッションストレージもクリア
        try {
          // Supabaseのセッション関連のストレージをクリア
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          if (supabaseUrl) {
            const projectId = supabaseUrl.split('//')[1]?.split('.')[0];
            if (projectId) {
              localStorage.removeItem(`sb-${projectId}-auth-token`);
            }
          }
          
          // その他のSupabase関連のストレージもクリア
          Object.keys(localStorage).forEach(key => {
            if (key.includes('supabase') || key.includes('sb-') || key.startsWith('supabase.')) {
              localStorage.removeItem(key);
            }
          });
          
          // sessionStorageもクリア
          try {
            sessionStorage.clear();
          } catch (e) {
            // sessionStorageが使えない環境では無視
          }
        } catch (storageError) {
          warn('[AuthContext] Webストレージクリアエラー');
        }
      } else {
        // Android/iOS環境では、AsyncStorageをクリア
        try {
          // オンボーディング関連のキーをクリア
          const allKeys = await AsyncStorage.getAllKeys();
          const supabaseKeys = allKeys.filter(key => 
            key.includes('supabase') || 
            key.includes('sb-') || 
            key.startsWith('supabase.') ||
            key.startsWith('hasCompletedOnboarding')
          );
          
          if (supabaseKeys.length > 0) {
            await AsyncStorage.multiRemove(supabaseKeys);
            debugLog('[AuthContext] AsyncStorageから削除', { count: supabaseKeys.length });
          }
          
          // ユーザーIDに関連するオンボーディングキーも削除
          if (user?.id) {
            const onboardingKey = `hasCompletedOnboarding_${user.id}`;
            await AsyncStorage.removeItem(onboardingKey);
          }
        } catch (storageError) {
          warn('[AuthContext] AsyncStorageクリアエラー');
        }
      }

      await clearLastAuthProvider();
      
      debugLog('[AuthContext] ログアウト処理完了、ログイン画面にリダイレクト', { platform: Platform.OS });
      
      if (shouldHoldAuthRedirect()) {
        debugLog('[AuthContext] 認証コールバック処理中のためログイン遷移を抑止', { platform: Platform.OS });
        return;
      }
      debugLog('[AuthContext] ログイン画面へ遷移:', { platform: Platform.OS });
      router.replace('/(auth)/login');
    } catch (error) {
      logError('[AuthContext] ログアウト処理中に予期しないエラー');
      // エラーが発生しても、ローカルの状態をクリアしてリダイレクト
      setSession(null);
      setUser(null);
      if (shouldHoldAuthRedirect()) {
        debugLog('[AuthContext] 認証コールバック処理中のためログイン遷移を抑止', { platform: Platform.OS });
        return;
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/(auth)/login';
      } else {
        router.replace('/(auth)/login');
      }
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = 'https://www.test-album.jp/auth/callback';
      log('[AuthContext] resetPassword redirectTo:', redirectUrl);
      debugLog('[パスワードリセット] リクエスト開始', { platform: Platform.OS });

      const { error, data } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        logError('[パスワードリセット] Supabaseエラー');
        return { error };
      }

      debugLog('[パスワードリセット] 成功');
      // セキュリティ上の理由で、Supabaseは存在しないメールアドレスでもエラーを返さない場合がある
      // そのため、常に成功メッセージを表示する
      return { error: null };
    } catch (err: any) {
      logError('[パスワードリセット] 予期しないエラー');
      return { error: err instanceof Error ? err : new Error('パスワードリセット中にエラーが発生しました') };
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        authLoading,
        initializing,
        sessionUserId: session?.user?.id ?? null,
        familyId,
        isFamilyReady,
        familyDisplayName,
        refreshFamilyDisplayName,
        isSetupReady,
        needsDisplayName,
        needsChildSetup,
        isConsentReady,
        needsConsent,
        refreshSetupStatus,
        saveConsent,
        setActiveFamilyId,
        signIn,
        signUp,
        signInWithGoogle,
        resetPassword,
        updatePassword,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
