type DebugLogEntry = {
  id: string;
  message: string;
  timestamp: number;
};

type DebugStatus = {
  lastAuthEvent: string;
  initializing: boolean;
  watchdogFired: boolean;
  lastLoginPressedAt: string;
  lastLoginResult: string;
};

const MAX_LOGS = 50;

let logs: DebugLogEntry[] = [];
let status: DebugStatus = {
  lastAuthEvent: '',
  initializing: false,
  watchdogFired: false,
  lastLoginPressedAt: '',
  lastLoginResult: '',
};

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const appendLog = (message: string) => {
  const entry: DebugLogEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message,
    timestamp: Date.now(),
  };
  logs = [entry, ...logs].slice(0, MAX_LOGS);
  notify();
};

export const getDebugLogs = () => logs;

export const subscribeDebugLogs = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setDebugAuthEvent = (event: string) => {
  status = { ...status, lastAuthEvent: event };
  notify();
};

export const setDebugInitializing = (initializing: boolean) => {
  status = { ...status, initializing };
  notify();
};

export const setDebugWatchdogFired = (fired: boolean) => {
  status = { ...status, watchdogFired: fired };
  notify();
};

export const setDebugLoginPressed = () => {
  status = { ...status, lastLoginPressedAt: new Date().toISOString() };
  notify();
};

export const setDebugLoginResult = (hasSession: boolean, errorMessage?: string) => {
  const summary = `hasSession=${hasSession} error=${errorMessage || 'none'}`;
  status = { ...status, lastLoginResult: summary };
  notify();
};

export const getDebugStatus = () => status;
