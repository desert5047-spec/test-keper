import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AppHeader } from '@/components/AppHeader';

export default function TermsOfServiceScreen() {
  return (
    <View style={styles.container}>
      <AppHeader showBack={true} showSettings={false} showChildSwitcher={false} title="利用規約" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.lastUpdate}>最終更新日: 2026年1月26日</Text>

          <Text style={styles.paragraph}>
            この利用規約（以下「本規約」）は、テストアルバム（以下「本アプリ」）の利用条件を定めるものです。本アプリをご利用いただく際には、本規約にご同意いただいたものとみなします。
          </Text>

          <Text style={styles.heading}>第1条（適用）</Text>
          <Text style={styles.paragraph}>
            本規約は、本アプリの利用に関する条件を定めるものであり、ユーザーと本アプリの提供者との間の本アプリの利用に関する一切の関係に適用されます。
          </Text>

          <Text style={styles.heading}>第2条（利用登録）</Text>
          <Text style={styles.paragraph}>
            本アプリの利用を希望する方は、本規約に同意の上、登録手続きを行うものとします。登録の完了により、ユーザーと本アプリとの間で利用契約が成立します。
          </Text>

          <Text style={styles.heading}>第3条（アカウント管理）</Text>
          <Text style={styles.paragraph}>
            ユーザーは、自己の責任においてアカウント情報を適切に管理するものとします。アカウント情報の管理不十分、使用上の過誤、第三者の使用等による損害の責任は、ユーザーが負うものとします。
          </Text>

          <Text style={styles.heading}>第4条（禁止事項）</Text>
          <Text style={styles.paragraph}>
            ユーザーは、本アプリの利用にあたり、以下の行為をしてはなりません：
          </Text>
          <Text style={styles.bulletPoint}>• 法令または公序良俗に違反する行為</Text>
          <Text style={styles.bulletPoint}>• 犯罪行為に関連する行為</Text>
          <Text style={styles.bulletPoint}>• 本アプリのサーバーやネットワークの機能を破壊または妨害する行為</Text>
          <Text style={styles.bulletPoint}>• 本アプリの運営を妨害するおそれのある行為</Text>
          <Text style={styles.bulletPoint}>• 他のユーザーに関する個人情報等を収集または蓄積する行為</Text>
          <Text style={styles.bulletPoint}>• 不正アクセスをする行為</Text>
          <Text style={styles.bulletPoint}>• 他のユーザーに成りすます行為</Text>
          <Text style={styles.bulletPoint}>• 本アプリを商業目的で利用する行為</Text>
          <Text style={styles.bulletPoint}>• その他、本アプリが不適切と判断する行為</Text>

          <Text style={styles.heading}>第5条（サービスの提供の停止等）</Text>
          <Text style={styles.paragraph}>
            本アプリは、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします：
          </Text>
          <Text style={styles.bulletPoint}>• システムの保守点検または更新を行う場合</Text>
          <Text style={styles.bulletPoint}>• 地震、落雷、火災、停電などの不可抗力により本サービスの提供が困難となった場合</Text>
          <Text style={styles.bulletPoint}>• その他、本アプリが本サービスの提供が困難と判断した場合</Text>

          <Text style={styles.heading}>第6条（著作権）</Text>
          <Text style={styles.paragraph}>
            本アプリおよび本アプリに関連するすべてのコンテンツの著作権は、本アプリまたは正当な権利を有する第三者に帰属します。ユーザーが本アプリに投稿したコンテンツの著作権は、ユーザーに帰属します。
          </Text>

          <Text style={styles.heading}>第7条（免責事項）</Text>
          <Text style={styles.paragraph}>
            本アプリは、本サービスに関して、以下について一切の責任を負いません：
          </Text>
          <Text style={styles.bulletPoint}>• ユーザーの特定の目的に適合すること</Text>
          <Text style={styles.bulletPoint}>• 期待する機能や正確性を有すること</Text>
          <Text style={styles.bulletPoint}>• 不具合が生じないこと</Text>
          <Text style={styles.bulletPoint}>• 利用によって生じる損害</Text>

          <Text style={styles.heading}>第8条（利用規約の変更）</Text>
          <Text style={styles.paragraph}>
            本アプリは、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。変更後の本規約は、本アプリに掲載された時点から効力を生じるものとします。
          </Text>

          <Text style={styles.heading}>第9条（準拠法・裁判管轄）</Text>
          <Text style={styles.paragraph}>
            本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、本アプリの所在地を管轄する裁判所を専属的合意管轄とします。
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
