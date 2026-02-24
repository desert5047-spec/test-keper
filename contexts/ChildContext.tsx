import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SELECTED_CHILD_ID_KEY = '@selected_child_id';

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

interface Child {
  id: string;
  name: string | null;
  grade: number | null;
  color: string;
}

interface ChildContextType {
  selectedChildId: string | null;
  setSelectedChildId: (id: string) => void;
  children: Child[];
  selectedChild: Child | null;
  loadChildren: () => Promise<void>;
}

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export function ChildProvider({ children: childrenProp }: { children: ReactNode }) {
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoadingChild, setIsLoadingChild] = useState(true);
  const { user, loading, familyId, isFamilyReady } = useAuth();

  // 永続化されたselectedChildIdを読み込む
  useEffect(() => {
    const loadPersistedChildId = async () => {
      try {
        const persistedId = await AsyncStorage.getItem(SELECTED_CHILD_ID_KEY);
        if (persistedId) {
          debugLog('[ChildContext] 永続化された子供IDを読み込み', { platform: Platform.OS });
          setSelectedChildIdState(persistedId);
        } else {
          debugLog('[ChildContext] 永続化された子供IDなし', { platform: Platform.OS });
        }
      } catch (error) {
        console.error('[ChildContext] 永続化された子供IDの読み込みエラー');
      } finally {
        setIsLoadingChild(false);
      }
    };

    loadPersistedChildId();
  }, []);

  const loadChildren = async () => {
    if (!user || !isFamilyReady || !familyId) {
      debugLog('[ChildContext] ユーザーが未ログインのため、子供を読み込めません', { platform: Platform.OS });
      if (!isFamilyReady || !familyId) {
        debugLog('[ChildContext] familyId 未確定のため待機', { platform: Platform.OS });
      }
      return;
    }

    debugLog('[ChildContext] 子供を読み込み中...', { platform: Platform.OS });

    const { data, error } = await supabase
      .from('children')
      .select('id, name, grade, color')
      .eq('family_id', familyId)
      .order('created_at');

    if (error) {
      console.error('[ChildContext] 子供の読み込みエラー');
      setChildren([]);
      return;
    }

    if (data && data.length > 0) {
      debugLog(`[ChildContext] ${data.length}人の子供を取得`, { 
        platform: Platform.OS 
      });
      setChildren(data);
      
      // selectedChildIdが設定されていない、または現在のselectedChildIdがchildrenに存在しない場合
      if (!selectedChildId || !data.find(c => c.id === selectedChildId)) {
        const newSelectedId = data[0].id;
        debugLog('[ChildContext] 子供を自動選択', { platform: Platform.OS });
        setSelectedChildIdState(newSelectedId);
        // 永続化
        try {
          await AsyncStorage.setItem(SELECTED_CHILD_ID_KEY, newSelectedId);
        } catch (storageError) {
          console.error('[ChildContext] 子供IDの永続化エラー');
        }
      } else {
        debugLog('[ChildContext] 既存の子供IDを使用', { platform: Platform.OS });
      }
    } else {
      debugLog('[ChildContext] 子供が登録されていません', { platform: Platform.OS });
      setChildren([]);
      setSelectedChildIdState(null);
      // 永続化されたIDもクリア
      try {
        await AsyncStorage.removeItem(SELECTED_CHILD_ID_KEY);
      } catch (storageError) {
        console.error('[ChildContext] 子供IDの削除エラー');
      }
    }
  };

  useEffect(() => {
    if (!loading && !isLoadingChild && user && isFamilyReady && familyId) {
      loadChildren();
    }
  }, [user, loading, isLoadingChild, isFamilyReady, familyId]);

  const setSelectedChildId = async (id: string) => {
    debugLog('[ChildContext] 子供IDを設定', { platform: Platform.OS });
    setSelectedChildIdState(id);
    // 永続化
    try {
      await AsyncStorage.setItem(SELECTED_CHILD_ID_KEY, id);
      debugLog('[ChildContext] 子供IDを永続化', { platform: Platform.OS });
    } catch (storageError) {
      console.error('[ChildContext] 子供IDの永続化エラー');
    }
  };

  const selectedChild = children.find(c => c.id === selectedChildId) || null;

  return (
    <ChildContext.Provider value={{
      selectedChildId,
      setSelectedChildId,
      children,
      selectedChild,
      loadChildren
    }}>
      {childrenProp}
    </ChildContext.Provider>
  );
}

export function useChild() {
  const context = useContext(ChildContext);
  if (context === undefined) {
    throw new Error('useChild must be used within a ChildProvider');
  }
  return context;
}
