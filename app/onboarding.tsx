import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const { height: screenHeight } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const {
    user,
    familyId,
    isFamilyReady,
    isSetupReady,
    needsDisplayName,
    needsChildSetup,
    refreshSetupStatus,
    familyDisplayName,
  } = useAuth();
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const refreshInFlightRef = useRef(false);
  const displayNameValue = displayNameInput.trim();
  const remainingChars = 4 - displayNameValue.length;
  const isDisplayNameValid = displayNameValue.length >= 1 && displayNameValue.length <= 4;

  useEffect(() => {
    setDisplayNameInput(familyDisplayName ?? '');
  }, [familyDisplayName]);

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
  }, [user, isFamilyReady, isSetupReady, needsDisplayName, needsChildSetup, router]);

  useFocusEffect(
    useCallback(() => {
      if (!user || !isFamilyReady || !familyId) return;
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      refreshSetupStatus().finally(() => {
        refreshInFlightRef.current = false;
      });
    }, [user, isFamilyReady, familyId, refreshSetupStatus])
  );

  const handleSaveDisplayName = async () => {
    if (!user || !familyId || !isFamilyReady) {
      setDisplayNameError('家族情報の取得中です。少し待ってから再度お試しください');
      return;
    }
    if (!isDisplayNameValid) {
      setDisplayNameError('1〜4文字で入力してください');
      return;
    }
    setDisplayNameError('');
    setIsSaving(true);

    const { error } = await supabase.rpc('update_family_display_name', {
      target_family_id: familyId,
      new_display_name: displayNameValue,
    });

    if (error) {
      console.error('[Onboarding] display_name 更新エラー');
      setDisplayNameError('保存に失敗しました');
      setIsSaving(false);
      return;
    }

    await refreshSetupStatus();
    setIsSaving(false);

    if (needsChildSetup) {
      router.replace('/register-child');
      return;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
      <View style={styles.container}>
      {!isFamilyReady || !isSetupReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>初期セットアップ</Text>
          <Text style={styles.description}>
            {needsDisplayName || needsChildSetup ? '名前設定' : 'はじめましょう'}
          </Text>

          {(needsDisplayName || needsChildSetup) && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>親の名前（ユーザーネーム）</Text>
              <Text style={styles.sectionDescription}>
                親の名前を設定できます（最大4文字）
              </Text>
              <TextInput
                style={styles.input}
                placeholder="例：ママ、パパ"
                placeholderTextColor="#999"
                maxLength={4}
                value={displayNameInput}
                onChangeText={(value) => {
                  setDisplayNameInput(value);
                  if (displayNameError) setDisplayNameError('');
                }}
              />
              <Text style={styles.remainingText}>あと{remainingChars}文字</Text>
              {displayNameError ? <Text style={styles.errorText}>{displayNameError}</Text> : null}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!isDisplayNameValid || isSaving) && styles.primaryButtonDisabled,
                ]}
                onPress={handleSaveDisplayName}
                disabled={!isDisplayNameValid || isSaving}
                activeOpacity={0.7}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>保存する</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {!needsDisplayName && (
            <View style={styles.card}>
              {needsChildSetup ? (
                <>
                  <Text style={styles.sectionTitle}>お子さま登録</Text>
                  <Text style={styles.sectionDescription}>
                    最初に1人だけ登録してください。あとから増やせます。
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.push('/register-child')}
                    activeOpacity={0.7}>
                    <Text style={styles.primaryButtonText}>お子さま登録へ</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>🎉 準備完了</Text>
                  <Text style={styles.sectionDescription}>
                    準備ができました！{'\n'}
                    さっそくテストを写真で残してみましょう。
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.replace('/add')}
                    activeOpacity={0.7}>
                    <Text style={styles.primaryButtonText}>テストを撮影する</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => router.replace('/(tabs)')}
                    activeOpacity={0.7}>
                    <Text style={styles.secondaryButtonText}>あとで登録する</Text>
                  </TouchableOpacity>
                  <Image
                    source={require('@/assets/images/onboarding-camera-promo.png')}
                    style={{
                      width: '100%',
                      height: screenHeight * 0.32,
                      maxHeight: screenHeight * 0.4,
                      marginTop: 24,
                      alignSelf: 'center',
                    }}
                    contentFit="contain"
                  />
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
    marginBottom: 6,
  },
  remainingText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#E74C3C',
    marginBottom: 6,
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#EEF6FF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#2563EB',
  },
});
