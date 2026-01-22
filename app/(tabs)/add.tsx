import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, RotateCw, RotateCcw, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { RecordType, StampType } from '@/types/database';

export default function AddScreen() {
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoRotation, setPhotoRotation] = useState<0 | 90 | 180 | 270>(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [newSubject, setNewSubject] = useState<string>('');
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const [type, setType] = useState<RecordType>('テスト');
  const [evaluationType, setEvaluationType] = useState<'score' | 'stamp'>('score');
  const [score, setScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('100');
  const [stamp, setStamp] = useState<StampType | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSubjects();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
  };

  const loadSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('name')
      .order('created_at');

    if (data) {
      setSubjects(data.map(s => s.name));
      if (data.length > 0) {
        setSelectedSubject(data[0].name);
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoRotation(0);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoRotation(0);
    }
  };

  const rotatePhotoRight = () => {
    setPhotoRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  };

  const rotatePhotoLeft = () => {
    setPhotoRotation((prev) => ((prev - 90 + 360) % 360) as 0 | 90 | 180 | 270);
  };

  const addNewSubject = async () => {
    if (!newSubject.trim()) return;

    const { error } = await supabase
      .from('subjects')
      .insert({ name: newSubject.trim() });

    if (!error) {
      setSubjects([...subjects, newSubject.trim()]);
      setSelectedSubject(newSubject.trim());
      setNewSubject('');
      setShowSubjectInput(false);
    }
  };

  const validateAndSave = async () => {
    if (!selectedSubject) {
      Alert.alert('エラー', '教科を選択してください');
      return;
    }

    if (evaluationType === 'score') {
      if (!score.trim()) {
        Alert.alert('エラー', '点数を入力してください');
        return;
      }
      const scoreNum = parseInt(score);
      const maxScoreNum = parseInt(maxScore);
      if (isNaN(scoreNum) || isNaN(maxScoreNum) || scoreNum < 0 || maxScoreNum <= 0) {
        Alert.alert('エラー', '有効な点数を入力してください');
        return;
      }
    } else {
      if (!stamp) {
        Alert.alert('エラー', 'スタンプを選択してください');
        return;
      }
    }

    setIsSaving(true);

    try {
      const { data: children } = await supabase
        .from('children')
        .select('id')
        .maybeSingle();

      if (!children) {
        throw new Error('子どもデータが見つかりません');
      }

      const { error } = await supabase
        .from('records')
        .insert({
          child_id: children.id,
          date,
          subject: selectedSubject,
          type,
          score: evaluationType === 'score' ? parseInt(score) : null,
          max_score: evaluationType === 'score' ? parseInt(maxScore) : 100,
          stamp: evaluationType === 'stamp' ? stamp : null,
          memo: memo.trim() || null,
          photo_uri: photoUri,
          photo_rotation: photoRotation,
        });

      if (error) throw error;

      Alert.alert('完了', `${type}を残しました`);
      resetForm();
      router.push('/(tabs)');
    } catch (error) {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setPhotoUri(null);
    setPhotoRotation(0);
    setScore('');
    setMaxScore('100');
    setStamp(null);
    setMemo('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>記録を残す</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>写真（任意）</Text>
          {photoUri ? (
            <View style={styles.photoContainer}>
              <View
                style={[
                  styles.photoWrapper,
                  {
                    transform: [{ rotate: `${photoRotation}deg` }],
                  },
                ]}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.photoActionButton}
                  onPress={rotatePhotoLeft}
                  activeOpacity={0.7}>
                  <RotateCcw size={20} color="#fff" />
                  <Text style={styles.photoActionText}>左回転</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoActionButton}
                  onPress={rotatePhotoRight}
                  activeOpacity={0.7}>
                  <RotateCw size={20} color="#fff" />
                  <Text style={styles.photoActionText}>右回転</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoActionButton, styles.removeButton]}
                  onPress={() => setPhotoUri(null)}
                  activeOpacity={0.7}>
                  <X size={20} color="#fff" />
                  <Text style={styles.photoActionText}>削除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoPickerContainer}>
              <TouchableOpacity
                style={styles.photoPickerButton}
                onPress={takePhoto}
                activeOpacity={0.7}>
                <Camera size={32} color="#4A90E2" />
                <Text style={styles.photoPickerText}>撮影する</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoPickerButton}
                onPress={pickImage}
                activeOpacity={0.7}>
                <Text style={styles.photoPickerIcon}>📷</Text>
                <Text style={styles.photoPickerText}>選択する</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>教科（必須）</Text>
          {!showSubjectInput ? (
            <>
              <View style={styles.chipContainer}>
                {subjects.map((subject) => (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.chip,
                      selectedSubject === subject && styles.chipSelected,
                    ]}
                    onPress={() => setSelectedSubject(subject)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.chipText,
                        selectedSubject === subject && styles.chipTextSelected,
                      ]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.chipAdd}
                  onPress={() => setShowSubjectInput(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.chipAddText}>+ その他</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={newSubject}
                onChangeText={setNewSubject}
                placeholder="教科名を入力"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={addNewSubject}
                activeOpacity={0.7}>
                <Text style={styles.addButtonText}>追加</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowSubjectInput(false);
                  setNewSubject('');
                }}
                activeOpacity={0.7}>
                <X size={24} color="#999" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>種類（必須）</Text>
          <View style={styles.chipContainer}>
            {(['テスト', 'プリント', 'ドリル', '確認'] as RecordType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.chip,
                  type === t && styles.chipSelected,
                ]}
                onPress={() => setType(t)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.chipText,
                    type === t && styles.chipTextSelected,
                  ]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>評価（必須）</Text>
          <View style={styles.evaluationTypeContainer}>
            <TouchableOpacity
              style={[
                styles.evaluationTypeButton,
                evaluationType === 'score' && styles.evaluationTypeButtonSelected,
              ]}
              onPress={() => setEvaluationType('score')}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.evaluationTypeText,
                  evaluationType === 'score' && styles.evaluationTypeTextSelected,
                ]}>
                点数で記録
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.evaluationTypeButton,
                evaluationType === 'stamp' && styles.evaluationTypeButtonSelected,
              ]}
              onPress={() => setEvaluationType('stamp')}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.evaluationTypeText,
                  evaluationType === 'stamp' && styles.evaluationTypeTextSelected,
                ]}>
                スタンプで記録
              </Text>
            </TouchableOpacity>
          </View>

          {evaluationType === 'score' ? (
            <View style={styles.scoreInputContainer}>
              <View style={styles.scoreInputRow}>
                <TextInput
                  style={styles.scoreInput}
                  value={score}
                  onChangeText={setScore}
                  placeholder="点数"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <Text style={styles.scoreLabel}>点</Text>
                <Text style={styles.scoreSeparator}>/</Text>
                <TextInput
                  style={styles.maxScoreInput}
                  value={maxScore}
                  onChangeText={setMaxScore}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <Text style={styles.scoreLabel}>点中</Text>
              </View>
            </View>
          ) : (
            <View style={styles.stampContainer}>
              {(['大変よくできました', 'よくできました', 'がんばりました'] as StampType[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.stampButton,
                    stamp === s && styles.stampButtonSelected,
                  ]}
                  onPress={() => setStamp(s)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.stampText,
                      stamp === s && styles.stampTextSelected,
                    ]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>日付（必須）</Text>
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>メモ（任意）</Text>
          <TextInput
            style={styles.memoInput}
            value={memo}
            onChangeText={setMemo}
            placeholder="メモを入力"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#999"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={validateAndSave}
          disabled={isSaving}
          activeOpacity={0.7}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>保存する</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  photoContainer: {
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  photoWrapper: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  removeButton: {
    backgroundColor: '#FF6B6B',
  },
  photoActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  photoPickerContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  photoPickerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  photoPickerIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  photoPickerText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipAdd: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  chipAddText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  addButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  evaluationTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  evaluationTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  evaluationTypeButtonSelected: {
    backgroundColor: '#4A90E2',
  },
  evaluationTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  evaluationTypeTextSelected: {
    color: '#fff',
  },
  scoreInputContainer: {
    alignItems: 'center',
  },
  scoreInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  maxScoreInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
  },
  scoreSeparator: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 4,
  },
  stampContainer: {
    gap: 12,
  },
  stampButton: {
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  stampButtonSelected: {
    backgroundColor: '#fff',
    borderColor: '#4A90E2',
  },
  stampText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  stampTextSelected: {
    color: '#4A90E2',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  memoInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
