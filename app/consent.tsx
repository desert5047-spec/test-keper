import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { webUrls } from '@/lib/urls';
import { warn } from '@/lib/logger';

export default function ConsentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saveConsent } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const privacyPolicyUrl = webUrls.privacy;
  const termsUrl = webUrls.terms;

  const openExternalLink = (path: '/terms' | '/privacy') => {
    const url = path === '/privacy' ? privacyPolicyUrl : termsUrl;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch(() => {
      warn('[Consent] 外部リンクを開けませんでした');
    });
  };

  const handleAgree = async () => {
    if (!agreed) return;
    setSaving(true);
    await saveConsent({ agreedTerms: true, agreedPrivacy: true });
    setSaving(false);
    router.replace('/onboarding');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>利用規約への同意</Text>
      <Text style={styles.description}>
        アプリのご利用にあたり、利用規約とプライバシーポリシーへの同意をお願いします。
      </Text>

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
        style={[styles.primaryButton, (!agreed || saving) && styles.primaryButtonDisabled]}
        onPress={handleAgree}
        disabled={!agreed || saving}
        activeOpacity={0.8}>
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>同意して続ける</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 24,
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
  primaryButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#fff',
  },
});
