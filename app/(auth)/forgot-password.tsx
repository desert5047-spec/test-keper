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
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();

  const handleResetPassword = async () => {
    if (!email) {
      setError('メールアドレスを入力してください');
      return;
    }

    // 簡単なメールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('正しいメールアドレスを入力してください');
      return;
    }

    setError('');
    setLoading(true);

    const { error: resetError } = await resetPassword(email);

    if (resetError) {
      console.error('[パスワードリセット] エラー:', resetError);
      // エラーメッセージを詳細に表示
      let errorMessage = 'パスワードリセットメールの送信に失敗しました。';
      
      if (resetError.message) {
        // Supabaseのエラーメッセージを表示
        if (resetError.message.includes('rate limit')) {
          errorMessage = '送信回数が多すぎます。しばらく時間をおいてから再度お試しください。';
        } else if (resetError.message.includes('email')) {
          errorMessage = 'メールアドレスが正しくないか、登録されていません。';
        } else {
          errorMessage = `エラー: ${resetError.message}`;
        }
      }
      
      setError(errorMessage);
      setLoading(false);
      return;
    }

    setLoading(false);
    // セキュリティ上の理由で、Supabaseは存在しないメールアドレスでもエラーを返さない場合がある
    // そのため、常に成功メッセージを表示する
    setEmailSent(true);
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
          activeOpacity={0.7}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>パスワードをリセット</Text>
          <Text style={styles.subtitle}>
            {emailSent
              ? 'パスワードリセット用のメールを送信しました。メール内のリンクをクリックして、新しいパスワードを設定してください。'
              : '登録されているメールアドレスを入力してください。パスワードリセット用のリンクを送信します。'}
          </Text>

          {!emailSent ? (
            <>
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
                  <Text style={styles.submitButtonText}>リセットメールを送信</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.8}>
              <Text style={styles.backToLoginText}>ログイン画面に戻る</Text>
            </TouchableOpacity>
          )}
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
});
