import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useChild } from '@/contexts/ChildContext';
import { useFonts, Nunito_400Regular, Nunito_700Bold, Nunito_600SemiBold } from '@expo-google-fonts/nunito';
import { SCHOOL_LEVELS, getGradesForLevel, type SchoolLevel } from '@/lib/subjects';
import { getDefaultBirthDateForGrade, inferGradeFromBirthDate } from '@/lib/grade';
import { BirthDatePickerField } from '@/components/BirthDatePickerField';

export default function RegisterChildScreen() {
  const router = useRouter();
  const { user, familyId, isFamilyReady, refreshSetupStatus } = useAuth();
  const { loadChildren } = useChild();
  const [name, setName] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>('elementary');
  const [grade, setGrade] = useState<number | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [fontsLoaded] = useFonts({
    'Nunito-Regular': Nunito_400Regular,
    'Nunito-SemiBold': Nunito_600SemiBold,
    'Nunito-Bold': Nunito_700Bold,
  });

  useEffect(() => {
    const checkExistingChildren = async () => {
      if (!user || !fontsLoaded || !isFamilyReady || !familyId) return;

      const { data: childrenData } = await supabase
        .from('children')
        .select('id')
        .eq('family_id', familyId)
        .limit(1);

      if (childrenData && childrenData.length > 0) {
        router.replace('/onboarding');
      }
    };

    checkExistingChildren();
  }, [user, fontsLoaded, router]);

  const grades = getGradesForLevel(schoolLevel);

  const handleSchoolLevelChange = (level: SchoolLevel) => {
    setSchoolLevel(level);
    setGrade(null);
  };

  const handleBirthDateChange = (value: string) => {
    setBirthDate(value);
    const inferred = inferGradeFromBirthDate(value);
    if (inferred) {
      setSchoolLevel(inferred.schoolLevel);
      setGrade(inferred.grade);
    }
  };

  const handleGradeSelect = (nextGrade: number) => {
    setGrade(nextGrade);
    // 学年主導UX: 学年変更時は代表生年月日(4/2)を毎回更新する。
    setBirthDate(getDefaultBirthDateForGrade(schoolLevel, nextGrade));
  };

  if (!fontsLoaded) {
    return null;
  }

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('入力エラー', 'お子さまの名前を入力してください');
      return;
    }
    if (trimmedName.length > 4) {
      Alert.alert('入力エラー', '4文字までで入力してください');
      return;
    }

    if (grade === null) {
      Alert.alert('入力エラー', '学年を選択してください');
      return;
    }

    if (!user || !isFamilyReady || !familyId) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('children').insert({
      name: trimmedName,
      // 互換用途: birth_date が未設定の既存データ向けに grade/school_level も保存継続。
      grade: grade.toString(),
      school_level: schoolLevel,
      birth_date: birthDate.trim() || null,
      color: '#999999',
      is_default: false,
      user_id: user.id,
      family_id: familyId,
    });

    setSaving(false);

    if (error) {
      console.error('Child registration error');
      Alert.alert('エラー', `登録に失敗しました: ${error.message}`);
      return;
    }

    await loadChildren();
    await refreshSetupStatus();

    router.replace('/onboarding');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
      <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>お子さまを登録</Text>
          <Text style={styles.subtitle}>最初に1人だけ。あとから増やせます</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              なまえ（ニックネーム） <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="例：太郎"
              placeholderTextColor="#CCCCCC"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={4}
            />
            <Text style={styles.hint}>1〜4文字で入力してください</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              学校区分 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.levelRow}>
              {SCHOOL_LEVELS.map((level) => (
                <Pressable
                  key={level.value}
                  style={[
                    styles.levelButton,
                    schoolLevel === level.value && styles.levelButtonSelected,
                  ]}
                  onPress={() => handleSchoolLevelChange(level.value)}>
                  <Text
                    style={[
                      styles.levelButtonText,
                      schoolLevel === level.value && styles.levelButtonTextSelected,
                    ]}>
                    {level.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              学年 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.gradeGrid}>
              {grades.map((gradeOption) => (
                <Pressable
                  key={gradeOption.value}
                  style={({ pressed }) => [
                    styles.gradeButton,
                    grade === gradeOption.value && styles.gradeButtonSelected,
                    pressed && styles.gradeButtonPressed,
                  ]}
                  onPress={() => handleGradeSelect(gradeOption.value)}
                  android_ripple={{ color: 'transparent' }}>
                  <Text
                    style={[
                      styles.gradeButtonText,
                      grade === gradeOption.value && styles.gradeButtonTextSelected,
                    ]}>
                    {gradeOption.label}
                  </Text>
                  {grade === gradeOption.value && (
                    <View style={styles.gradeIndicator} />
                  )}
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>あとから変更できます</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.optionalLabel}>生年月日（任意）</Text>
            <BirthDatePickerField
              value={birthDate}
              onChange={handleBirthDateChange}
              placeholder="タップして選択"
            />
            <Text style={styles.optionalHint}>通常は学年選択だけでOKです（未入力時は内部で 4/2 を設定）</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}>
          <Text style={styles.saveButtonText}>{saving ? '登録中...' : 'はじめる'}</Text>
        </TouchableOpacity>
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Nunito-Bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#999',
  },
  form: {
    gap: 24,
    marginBottom: 40,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
  },
  required: {
    color: '#E74C3C',
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    color: '#1A1A1A',
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginTop: 4,
  },
  optionalLabel: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#888',
  },
  optionalHint: {
    fontSize: 11,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginTop: 4,
  },
  levelRow: {
    flexDirection: 'row',
    gap: 10,
  },
  levelButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none' as any,
      cursor: 'pointer',
    }),
  },
  levelButtonSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#EFF6FF',
  },
  levelButtonText: {
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  levelButtonTextSelected: {
    color: '#4A90E2',
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gradeButton: {
    flex: 1,
    minWidth: '47%' as any,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: '#999999',
    flexDirection: 'row',
    gap: 8,
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none' as any,
      outlineWidth: 0,
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
    }),
  },
  gradeButtonSelected: {
    borderColor: '#4A90E2',
  },
  gradeButtonPressed: {
    opacity: 0.7,
  },
  gradeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(211, 211, 211, 1)',
  },
  gradeButtonText: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
  },
  gradeButtonTextSelected: {
    color: '#4A90E2',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
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
  },
  saveButtonDisabled: {
    backgroundColor: '#CCC',
    shadowOpacity: 0,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
  },
});
