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
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Check, Eye, EyeOff } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [resetAccessToken, setResetAccessToken] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updatePassword } = useAuth();
  const params = useLocalSearchParams();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  useEffect(() => {
    const checkResetToken = async () => {
      try {
        const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timeout`)), ms);
          });
          return Promise.race([promise, timeoutPromise]);
        };

        const accessTokenFromParams = params.access_token as string | undefined;
        const typeFromParams = params.type as string | undefined;
        const codeFromParams = params.code as string | undefined;
        const refreshTokenFromParams = params.refresh_token as string | undefined;
        let accessToken = accessTokenFromParams ?? null;
        let type = typeFromParams ?? null;
        let code = codeFromParams ?? null;
        let refreshToken = refreshTokenFromParams ?? null;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          accessToken = accessToken ?? hashParams.get('access_token');
          refreshToken = refreshToken ?? hashParams.get('refresh_token');
          type = type ?? hashParams.get('type');

          const searchParams = new URLSearchParams(window.location.search);
          code = code ?? searchParams.get('code');
          refreshToken = refreshToken ?? searchParams.get('refresh_token');
          type = type ?? searchParams.get('type');
        }

        if (type === 'recovery' && code) {
          const { error: exchangeError } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            10000,
            'exchangeCodeForSession'
          );
          if (exchangeError) {
            console.error('コード検証エラー');
            setError('無効または期限切れのリンクです。');
            setIsValidToken(false);
            setCheckingToken(false);
            return;
          }
          setIsValidToken(true);
          setCheckingToken(false);
          return;
        }

        if (type === 'recovery' && accessToken) {
          setResetAccessToken(accessToken);
          setIsValidToken(true);
          setCheckingToken(false);
          return;
        }

        if (type === 'recovery') {
          setError('無効または期限切れのリンクです。');
          setIsValidToken(false);
          setCheckingToken(false);
          return;
        }

        // 既存のセッションを確認（リセットフロー中の場合）
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsValidToken(true);
        } else {
          setError('無効または期限切れのリンクです。');
          setIsValidToken(false);
        }
      } catch (err) {
        console.error('トークンチェックエラー');
        setError('リンクの検証に失敗しました。');
        setIsValidToken(false);
      } finally {
        setCheckingToken(false);
      }
    };

    checkResetToken();
  }, [params]);

  const updatePasswordWithToken = async (token: string, newPassword: string) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabaseの設定が見つかりません');
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody?.error_description || errorBody?.message || '不明なエラー';
      throw new Error(message);
    }
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      setError('新しいパスワードを入力してください');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (resetAccessToken) {
        await updatePasswordWithToken(resetAccessToken, password);
      } else {
        const { error: updateError } = await updatePassword(password);
        if (updateError) {
          throw updateError;
        }
      }
    } catch (updateError: any) {
      console.error('パスワード更新エラー');
      setError('パスワードの更新に失敗しました。もう一度お試しください。');
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccess(true);

    // 3秒後にログイン画面にリダイレクト
    setTimeout(() => {
      router.replace('/(auth)/login');
    }, 3000);
  };

  if (checkingToken) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>リンクを確認中...</Text>
      </View>
    );
  }

  if (!isValidToken) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.7}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.content}>
            <Text style={styles.title}>リンクが無効です</Text>
            <Text style={styles.subtitle}>
              このリンクは無効または期限切れです。パスワードリセットメールを再度送信してください。
            </Text>

            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={() => router.replace('/(auth)/forgot-password')}
              activeOpacity={0.8}>
              <Text style={styles.backToLoginText}>パスワードリセットを再送信</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (success) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.successIcon}>
          <Check size={48} color="#4CAF50" strokeWidth={3} />
        </View>
        <Text style={styles.successTitle}>パスワードを更新しました</Text>
        <Text style={styles.successText}>ログイン画面に戻ります...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.7}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>新しいパスワードを設定</Text>
          <Text style={styles.subtitle}>
            新しいパスワードを入力してください（6文字以上）
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>新しいパスワード</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="新しいパスワード"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password-new"
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
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>パスワード（確認）</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="パスワード（確認）"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                activeOpacity={0.7}>
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#999" />
                ) : (
                  <Eye size={20} color="#999" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>パスワードを更新</Text>
            )}
          </TouchableOpacity>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backButton: {
    marginBottom: 24,
    padding: 8,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    lineHeight: 24,
    marginBottom: 32,
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
  submitButton: {
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
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#fff',
  },
  backToLoginButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4A90E2',
    minHeight: 56,
  },
  backToLoginText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#4A90E2',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#666',
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#666',
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
