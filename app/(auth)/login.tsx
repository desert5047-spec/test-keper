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
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogleExpoGo } from '@/lib/auth';
import { getLastAuthProvider } from '@/lib/auth/lastProvider';
import { getRememberMe, setRememberMe } from '@/lib/authStorage';
import { Eye, EyeOff } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lastLoginMethod, setLastLoginMethod] = useState<string | null>(null);
  const [rememberMe, setRememberMeState] = useState(true);
  const enableGoogleAuth = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';

  // 前回のログイン手段を確認
  useEffect(() => {
    const checkLastLogin = async () => {
      const provider = await getLastAuthProvider();
      if (provider === 'google') {
        setLastLoginMethod('Google');
        console.log('[認証手段] ログイン画面: 前回はGoogleでログイン');
        return;
      }
      if (provider === 'email') {
        setLastLoginMethod('Email');
        console.log('[認証手段] ログイン画面: 前回はEmailでログイン');
        return;
      }
      setLastLoginMethod(null);
      console.log('[認証手段] ログイン画面: 前回のログイン手段なし');
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

  const handleLogin = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    console.log('[Login] ログイン処理開始', { email, platform: Platform.OS });
    setError('');
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      const { error: signInError } = await signIn(trimmedEmail, password);

      if (signInError) {
        const message = (signInError as any)?.message ?? '';
        const isInvalidCredentials = message.includes('Invalid login credentials');
        if (isInvalidCredentials) {
          console.warn('[Login] ログイン失敗（認証情報不一致）:', signInError);
        } else {
          console.error('[Login] ログインエラー:', signInError);
        }
        setError(
          message && !isInvalidCredentials
            ? message
            : 'ログインに失敗しました。メールアドレスとパスワードを確認してください。'
        );
        setLoading(false);
        return;
      }

      console.log('[Login] ログイン成功、onAuthStateChangeを待機中...');
      // onAuthStateChangeが発火するまで少し待つ
      // リダイレクトはAuthContextのonAuthStateChangeで処理される
      setLoading(false);
    } catch (err: any) {
      console.error('[Login] ログイン処理例外:', err);
      setError('ログイン中にエラーが発生しました。もう一度お試しください。');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      // Platform.OS で必ず分岐
      if (Platform.OS === 'web') {
        // Webのときだけ window.location.origin を使った signInWithOAuth を実行
        const { error: googleError } = await signInWithGoogle();
        if (googleError) {
          setError('Google認証に失敗しました。もう一度お試しください。');
        }
        // Web環境では、リダイレクト後にonAuthStateChangeが自動的に発火する
      } else {
        // iOS/Android のときは必ず signInWithGoogleExpoGo() を呼ぶ
        console.log('[Login] signInWithGoogleExpoGo 呼び出し', { platform: Platform.OS });
        const { session, url } = await signInWithGoogleExpoGo();
        console.log('[Login] signInWithGoogleExpoGo 完了', { hasSession: !!session, hasUrl: !!url, platform: Platform.OS });
        // 認証成功時は、AuthContextのonAuthStateChangeが自動的に処理するため
        // ここでは何もしない
        // セッションが取得できた場合は、onAuthStateChangeが発火するのを待つ
        if (session) {
          console.log('[Login] セッション取得済み、onAuthStateChangeを待機中...', { platform: Platform.OS });
          // セッションが確立されるまで少し待つ
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log('[Login] セッションが取得できませんでした、callback.tsxでの処理を待ちます', { platform: Platform.OS });
          if (url) {
            console.log('[Login] callback 画面へ遷移', { platform: Platform.OS });
            router.replace({
              pathname: '/(auth)/callback',
              params: { url: encodeURIComponent(url) },
            });
          }
        }
      }
    } catch (googleError: any) {
      console.error('[Google認証] エラー:', googleError);
      setError('Google認証に失敗しました。もう一度お試しください。');
    } finally {
      setGoogleLoading(false);
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
          {lastLoginMethod ? (
            <Text style={styles.lastLoginText}>前回のログイン: {lastLoginMethod}</Text>
          ) : null}
          {!enableGoogleAuth ? (
            <Text style={styles.googleNoticeText}>
              Googleログインは現在調整中です。メールでログインしてください。
            </Text>
          ) : null}
        </View>

        <View style={styles.form}>
          {enableGoogleAuth ? (
            <>
              <TouchableOpacity
                style={[styles.googleButton, (loading || googleLoading) && styles.googleButtonDisabled]}
                onPress={handleGoogleLogin}
                disabled={loading || googleLoading}
                activeOpacity={0.8}>
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#333" />
                ) : (
                  <>
                    <View style={styles.googleIconContainer}>
                      <Svg width="20" height="20" viewBox="0 0 24 24">
                        <Path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <Path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <Path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <Path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </Svg>
                    </View>
                    <Text style={styles.googleButtonLabel}>Googleでログイン</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>または</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          ) : null}

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
