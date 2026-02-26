import React, { useEffect } from 'react';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export function useFrameworkReady() {
  useEffect(() => {
    try {
      if (__DEV__) console.log('[useFrameworkReady] STEP 1');
      if (typeof window !== 'undefined') {
        if (__DEV__) console.log('[useFrameworkReady] STEP 2');
        window.frameworkReady?.();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[useFrameworkReady] エラー', error);
      } else {
        console.warn('[useFrameworkReady] framework init failed');
      }
      // 本番では絶対に throw しない
    }
  });
}
