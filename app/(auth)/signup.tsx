import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogleExpoGo } from '@/lib/auth';
import { BookOpen, ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const enableGoogleAuth = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
  const lpBaseUrl = process.env.EXPO_PUBLIC_LP_URL ?? 'https://example.com';
  const pendingConsentKey = 'pendingConsent';

  const openExternalLink = (path: '/terms' | '/privacy') => {
    const url = `${lpBaseUrl}${path}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch((error) => {
      console.warn('[Signup] 外部リンクを開けませんでした:', error);
    });
  };

  const persistPendingConsent = async () => {
    try {
      const agreedAt = new Date().toISOString();
      const payload = {
        agreedTerms: true,
        agreedPrivacy: true,
        agreedAt,
        email: email.trim() || null,
      };
      await AsyncStorage.setItem(pendingConsentKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('[Signup] 同意情報の保存に失敗:', error);
    }
  };

  const handleSignup = async () => {
    if (!agreed) {
      setError('利用規約とプライバシーポリシーへの同意をお願いします');
      return;
    }
    if (!email || !password || !confirmPassword) {
      setError('全ての項目を入力してください');
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
    setSuccessMessage('');
    setLoading(true);
    await persistPendingConsent();

    const { error: signUpError } = await signUp(email, password, {
      agreedTerms: agreed,
      agreedPrivacy: agreed,
    });

    if (signUpError) {
      console.error('[Signup] 登録エラー:', signUpError);
      if (signUpError.message?.toLowerCase().includes('already registered')) {
        setError('既に登録されています。ログインをお試しください。');
      } else {
        setError('登録に失敗しました。別のメールアドレスをお試しください。');
      }
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccessMessage('登録ありがとうございます。メールアドレスに認証用メールを送信しましたので、メールを確認して承認してください。');
    setShowSuccess(true);

    // 5秒後にログイン画面に遷移
    setTimeout(() => {
      setShowSuccess(false);
      router.replace('/(auth)/login');
    }, 5000);
  };

  const handleGoogleSignup = async () => {
    if (!agreed) {
      setError('利用規約とプライバシーポリシーへの同意をお願いします');
      return;
    }
    setGoogleLoading(true);
    setError('');
    await persistPendingConsent();

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
        const { url } = await signInWithGoogleExpoGo();
        if (url) {
          router.replace({
            pathname: '/(auth)/callback',
            params: { url: encodeURIComponent(url) },
          });
        }
        // 認証成功時は、AuthContextのonAuthStateChangeが自動的に処理するため
        // ここでは何もしない
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
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
          activeOpacity={0.7}>
          <ChevronLeft size={24} color="#333" strokeWidth={2} />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <BookOpen size={48} color="#4A90E2" strokeWidth={2} />
          </View>
          <Text style={styles.title}>新規登録</Text>
          <Text style={styles.subtitle}>アカウントを作成して始めましょう</Text>
        </View>

        <View style={styles.form}>
          {enableGoogleAuth ? (
            <>
              <TouchableOpacity
                style={[
                  styles.googleButton,
                  (loading || googleLoading || !agreed) && styles.googleButtonDisabled,
                ]}
                onPress={handleGoogleSignup}
                disabled={loading || googleLoading || !agreed}
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
                    <Text style={styles.googleButtonLabel}>Googleで登録</Text>
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
                placeholder="6文字以上"
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
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>パスワード（確認）</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="もう一度入力"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="password"
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

          {showSuccess && successMessage ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          {!showSuccess && (
            <>
              <Pressable
                style={styles.agreeRow}
                onPress={() => setAgreed((prev) => !prev)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}>
                <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                  {agreed ? <View style={styles.checkboxInner} /> : null}
                </View>
                <Text style={styles.agreeText}>
                  <Text
                    style={styles.linkText}
                    onPress={() => openExternalLink('/terms')}>
                    利用規約
                  </Text>
                  および
                  <Text
                    style={styles.linkText}
                    onPress={() => openExternalLink('/privacy')}>
                    プライバシーポリシー
                  </Text>
                  に同意します
                </Text>
              </Pressable>
              <TouchableOpacity
                style={[
                  styles.signupButton,
                  (loading || !agreed) && styles.signupButtonDisabled,
                ]}
                onPress={handleSignup}
                disabled={loading || !agreed}
                activeOpacity={0.8}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.signupButtonText}>登録する</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {showSuccess && (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => {
                setShowSuccess(false);
                router.replace('/(auth)/login');
              }}
              activeOpacity={0.8}>
              <Text style={styles.loginButtonText}>ログイン画面へ</Text>
            </TouchableOpacity>
          )}

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>既にアカウントをお持ちですか？</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              disabled={loading}
              activeOpacity={0.7}>
              <Text style={styles.loginLink}>ログイン</Text>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
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
  successContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  successText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#2E7D32',
    textAlign: 'center',
    lineHeight: 20,
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
    marginTop: 16,
  },
  loginButtonText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#fff',
  },
  signupButton: {
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
      },
    }),
    elevation: 4,
    minHeight: 56,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#fff',
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BDBDBD',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: '#4A90E2',
    backgroundColor: '#4A90E2',
  },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  agreeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    lineHeight: 20,
  },
  linkText: {
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 4,
  },
  loginText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#4A90E2',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
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
