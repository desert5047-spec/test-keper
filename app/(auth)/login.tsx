import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { getLastAuthProvider } from '@/lib/auth/lastProvider';
import { getRememberMe, setRememberMe } from '@/lib/authStorage';
import { Eye, EyeOff } from 'lucide-react-native';
import { appendLog, setDebugLoginPressed, setDebugLoginResult } from '@/lib/debugLog';
import { supabase } from '@/lib/supabase';

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, initializing } = useAuth();
  const [lastLoginMethod, setLastLoginMethod] = useState<string | null>(null);
  const [rememberMe, setRememberMeState] = useState(true);

  // 前回のログイン手段を確認
  useEffect(() => {
    const checkLastLogin = async () => {
      const provider = await getLastAuthProvider();
      if (provider === 'google') {
        setLastLoginMethod('Google');
        debugLog('[認証手段] ログイン画面: 前回はGoogleでログイン');
        return;
      }
      if (provider === 'email') {
        setLastLoginMethod('Email');
        debugLog('[認証手段] ログイン画面: 前回はEmailでログイン');
        return;
      }
      setLastLoginMethod(null);
      debugLog('[認証手段] ログイン画面: 前回のログイン手段なし');
    };
    checkLastLogin();
  }, []);

  useEffect(() => {
    const loadRememberMe = async () => {
      const stored = await getRememberMe();
      setRememberMeState(stored);
    };
    loadRememberMe();
  }, []);

  const handleRememberMeChange = async (value: boolean) => {
    setRememberMeState(value);
    await setRememberMe(value);
  };

  useEffect(() => {
    if (initializing) return;
    if (session?.user) {
      router.replace('/(tabs)');
    }
  }, [initializing, session?.user, router]);

  const handleLogin = async () => {
    console.log('LOGIN PRESSED');
    appendLog('LOGIN PRESSED');
    setDebugLoginPressed();
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    debugLog('[Login] ログイン処理開始', { platform: Platform.OS });
    setError('');
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      console.log('[LOGIN] error:', signInError);
      console.log('[LOGIN] data.session exists:', !!data?.session);
      console.log('[LOGIN] getSession:', !!(await supabase.auth.getSession()).data.session);
      console.log('LOGIN RESULT', { hasSession: !!data?.session, error: signInError?.message });
      appendLog(
        `LOGIN RESULT hasSession=${!!data?.session} error=${signInError?.message || 'none'}`
      );
      setDebugLoginResult(!!data?.session, signInError?.message);

      if (signInError) {
        const message = (signInError as any)?.message ?? '';
        const isInvalidCredentials = message.includes('Invalid login credentials');
        if (isInvalidCredentials) {
          console.warn('[Login] ログイン失敗（認証情報不一致）');
        } else {
          console.error('[Login] ログインエラー');
        }
        setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
        Alert.alert('ログインできませんでした', signInError?.message ?? 'もう一度お試しください。');
        return;
      }

      console.log('[LOGIN] success -> replace /(tabs)');
      router.replace('/(tabs)');
      setTimeout(() => {
        console.log('[LOGIN] fallback replace /(tabs)');
        router.replace('/(tabs)');
      }, 1000);
    } catch (err: any) {
      console.error('[Login] ログイン処理例外');
      setError('ログイン中にエラーが発生しました。もう一度お試しください。');
      Alert.alert('ログイン中にエラーが発生しました', err?.message ?? 'もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Image
              source={require('@/assets/images/app-icon.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>テストアルバム</Text>
          <Text style={styles.subtitle}>写真でかんたん、テスト記録アプリ</Text>
        </View>

        <View style={styles.form}>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>パスワード</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="パスワード"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                activeOpacity={0.7}>
                {showPassword ? (
                  <EyeOff size={20} color="#999" />
                ) : (
                  <Eye size={20} color="#999" />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              disabled={loading}
              style={styles.forgotPasswordLink}
              activeOpacity={0.7}>
              <Text style={styles.forgotPasswordText}>パスワードを忘れた場合</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rememberRow}>
            <Text style={styles.rememberLabel}>次回のためログイン情報を保存</Text>
            <Switch
              value={rememberMe}
              onValueChange={handleRememberMeChange}
              trackColor={{ false: '#e0e0e0', true: '#A5C7F7' }}
              thumbColor={rememberMe ? '#4A90E2' : '#f4f4f4'}
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>ログイン</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>アカウントをお持ちでないですか？</Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/signup')}
              disabled={loading}
              activeOpacity={0.7}>
              <Text style={styles.signupLink}>新規登録</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  appIcon: {
    width: 96,
    height: 96,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#666',
  },
  lastLoginText: {
    marginTop: 30,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#4A90E2',
  },
  googleNoticeText: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#888',
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  errorContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#E74C3C',
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(74, 144, 226, 0.3)',
      },
      default: {
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
    minHeight: 56,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#fff',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 4,
  },
  signupText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
  },
  signupLink: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#4A90E2',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginHorizontal: 16,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 12,
    minHeight: 56,
    marginBottom: 24,
    ...(Platform.OS === 'web' && { cursor: 'pointer' as const }),
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonLabel: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
  },
  forgotPasswordLink: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#4A90E2',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rememberLabel: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#333',
  },
  eyeIcon: {
    padding: 12,
  },
});
