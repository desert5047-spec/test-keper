import React, { createContext, useCallback, useContext, useState } from 'react';

type PendingAction = () => void;

type GuardConfig = {
  /** 未保存の変更がある場合に遷移を止めて確認 Alert を表示する */
  showAlert: (action: PendingAction) => void;
};

type ContextValue = {
  /** 編集画面が register した場合、遷移前にガードを挟む */
  guardNavigate: (action: PendingAction) => void;
  /** 編集画面が editMode && isDirty のとき register する */
  registerGuard: (config: GuardConfig | null) => void;
};

const UnsavedChangesContext = createContext<ContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [guard, setGuard] = useState<GuardConfig | null>(null);

  const registerGuard = useCallback((config: GuardConfig | null) => {
    setGuard(() => config);
  }, []);

  const guardNavigate = useCallback(
    (action: PendingAction) => {
      if (guard) {
        guard.showAlert(action);
      } else {
        action();
      }
    },
    [guard]
  );

  return (
    <UnsavedChangesContext.Provider value={{ guardNavigate, registerGuard }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedGuard() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    return {
      guardNavigate: (action: PendingAction) => action(),
      registerGuard: (_: GuardConfig | null) => {},
    };
  }
  return ctx;
}
