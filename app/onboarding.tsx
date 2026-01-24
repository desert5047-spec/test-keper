import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const slides = [
  {
    title: '学校のテストを、ちゃんと残すだけのアプリです。',
    description: '捨てられないテストを、画像に残しておけます。',
  },
  {
    title: '残っている。',
    description: 'それだけで十分です。',
  },
  {
    title: 'さっそく始めましょう。',
    description: 'テストやプリントを撮って、簡単に残せます。',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleStart = async () => {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    router.replace('/register-child');
  };

  const slide = slides[currentIndex];
  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </View>

        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={isLastSlide ? handleStart : handleNext}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>
            {isLastSlide ? 'テストを残してみる' : '次へ'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Nunito-SemiBold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
    lineHeight: 34,
  },
  description: {
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#4A90E2',
    width: 24,
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 28,
    marginBottom: 40,
    minWidth: 200,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    textAlign: 'center',
  },
});
