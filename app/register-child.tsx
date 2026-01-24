import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFonts, Nunito_400Regular, Nunito_700Bold, Nunito_600SemiBold } from '@expo-google-fonts/nunito';

const GRADES = [
  { label: '小学1年', value: 1 },
  { label: '小学2年', value: 2 },
  { label: '小学3年', value: 3 },
  { label: '小学4年', value: 4 },
  { label: '小学5年', value: 5 },
  { label: '小学6年', value: 6 },
];

export default function RegisterChildScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [fontsLoaded] = useFonts({
    'Nunito-Regular': Nunito_400Regular,
    'Nunito-SemiBold': Nunito_600SemiBold,
    'Nunito-Bold': Nunito_700Bold,
  });

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

    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('children').insert({
      name: trimmedName,
      grade,
      color: '#4A90E2',
      is_default: false,
      user_id: user.id,
    });

    setSaving(false);

    if (error) {
      Alert.alert('エラー', '登録に失敗しました');
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
              placeholder="例：真央"
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
              学年 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.gradeGrid}>
              {GRADES.map((gradeOption) => (
                <TouchableOpacity
                  key={gradeOption.value}
                  style={[
                    styles.gradeButton,
                    grade === gradeOption.value && styles.gradeButtonSelected,
                  ]}
                  onPress={() => setGrade(gradeOption.value)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.gradeButtonText,
                      grade === gradeOption.value && styles.gradeButtonTextSelected,
                    ]}>
                    {gradeOption.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginTop: 4,
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gradeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  gradeButtonSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  gradeButtonText: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
  },
  gradeButtonTextSelected: {
    color: '#FFF',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
