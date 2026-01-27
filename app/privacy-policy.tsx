import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AppHeader } from '@/components/AppHeader';

export default function PrivacyPolicyScreen() {
  return (
    <View style={styles.container}>
      <AppHeader showBack={true} showSettings={false} showChildSwitcher={false} title="プライバシーポリシー" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.lastUpdate}>最終更新日: 2026年1月26日</Text>

          <Text style={styles.paragraph}>
            テストアルバム（以下「本アプリ」）は、ユーザーの皆様のプライバシーを尊重し、個人情報の保護に努めています。本プライバシーポリシーは、本アプリにおける個人情報の取り扱いについて説明するものです。
          </Text>

          <Text style={styles.heading}>1. 収集する情報</Text>
          <Text style={styles.paragraph}>
            本アプリでは、以下の情報を収集する場合があります：
          </Text>
          <Text style={styles.bulletPoint}>• メールアドレス（アカウント作成時）</Text>
          <Text style={styles.bulletPoint}>• お子様の名前や学年などの情報</Text>
          <Text style={styles.bulletPoint}>• テストの記録や写真</Text>
          <Text style={styles.bulletPoint}>• アプリの利用状況に関する情報</Text>

          <Text style={styles.heading}>2. 情報の利用目的</Text>
          <Text style={styles.paragraph}>
            収集した情報は、以下の目的で利用します：
          </Text>
          <Text style={styles.bulletPoint}>• アカウント管理とユーザー認証</Text>
          <Text style={styles.bulletPoint}>• サービスの提供と機能の改善</Text>
          <Text style={styles.bulletPoint}>• ユーザーサポートの提供</Text>
          <Text style={styles.bulletPoint}>• アプリの不正利用の防止</Text>

          <Text style={styles.heading}>3. 情報の保存と管理</Text>
          <Text style={styles.paragraph}>
            ユーザーの情報は、Supabaseのセキュアなデータベースに保存されます。データは暗号化され、適切なセキュリティ対策が施されています。
          </Text>

          <Text style={styles.heading}>4. 第三者への情報提供</Text>
          <Text style={styles.paragraph}>
            本アプリは、以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません：
          </Text>
          <Text style={styles.bulletPoint}>• ユーザーの同意がある場合</Text>
          <Text style={styles.bulletPoint}>• 法令に基づく場合</Text>
          <Text style={styles.bulletPoint}>• 人の生命、身体または財産の保護のために必要な場合</Text>

          <Text style={styles.heading}>5. データの削除</Text>
          <Text style={styles.paragraph}>
            ユーザーは、アプリの設定画面から「データを初期化」機能を使用することで、すべてのデータを削除することができます。また、アカウントを削除することで、関連するすべての情報が削除されます。
          </Text>

          <Text style={styles.heading}>6. お子様のプライバシー</Text>
          <Text style={styles.paragraph}>
            本アプリは、保護者がお子様の学習記録を管理するためのものです。お子様の情報は、保護者の管理下で適切に取り扱われます。
          </Text>

          <Text style={styles.heading}>7. プライバシーポリシーの変更</Text>
          <Text style={styles.paragraph}>
            本プライバシーポリシーは、必要に応じて変更されることがあります。重要な変更がある場合は、アプリ内で通知します。
          </Text>

          <Text style={styles.heading}>8. お問い合わせ</Text>
          <Text style={styles.paragraph}>
            本プライバシーポリシーに関するご質問やご意見がございましたら、アプリ内のサポート機能からお問い合わせください。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
    paddingTop: 108,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  lastUpdate: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginBottom: 20,
  },
  heading: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 8,
  },
});
