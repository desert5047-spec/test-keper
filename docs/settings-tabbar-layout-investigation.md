# 設定画面 TabBar 浮く問題 - 原因調査

## 1. 比較結果（設定 vs ホーム）

| 項目 | 設定画面 (app/settings.tsx) | ホーム画面 (app/(tabs)/index.tsx) |
|------|---------------------------|----------------------------------|
| **SafeAreaView** | ✅ `edges={['bottom']}` | ✅ `edges={['bottom']}` |
| **useSafeAreaInsets()** | ✅ 使用 | ❌ 未使用 |
| **useHeaderTop()** | ❌ 未使用 | ✅ 使用 |
| **useSafeBottom()** | ✅ 使用 (safeBottom) | ❌ 未使用 |
| **contentContainerStyle.paddingBottom** | ✅ `safeBottom + 120` | `paddingBottom: 24` （FlatList） |
| **KeyboardAvoidingView** | ❌ なし | ❌ なし |
| **contentInsetAdjustmentBehavior** | ❌ なし | ❌ なし |
| **automaticallyAdjustKeyboardInsets** | ❌ なし | ❌ なし |
| **独自 bottomNav** | ✅ あり（TabBar風）height: `TAB_BAR_HEIGHT + ... + safeBottom` | ❌ なし（Tabs が描画） |

## 2. 違いのポイント

### 設定画面の構成
- **SafeAreaView `edges={['bottom']}`** → 画面下部に `insets.bottom` 分のパディングを追加
- **useSafeBottom(16)** → Android では `Math.max(insets.bottom, 16)`
- **独自 bottomNav** → 高さに `safeBottom` を含む（`paddingBottom: TAB_ITEM_PADDING_BOTTOM + safeBottom`）
- **ScrollView paddingBottom** → `safeBottom + 120`

→ **bottom の余白が二重にかかっている可能性あり**

### ホーム画面の構成
- **SafeAreaView `edges={['bottom']}`** → 同様
- **TabBar は (tabs)/_layout が描画** → `useSafeBottom(16)` で高さを計算
- **FlatList paddingBottom** → `24` のみ（TabBar 用の余白は Tabs 側が管理）

→ **bottom は Tabs が一元的に管理**

## 3. TabBarが上がる直接原因候補（3つ）

### 候補1: SafeAreaView edges={['bottom']} の二重適用
設定画面で `edges={['bottom']}` を使うと、コンテナ全体が `insets.bottom` 分だけ上に縮む。その中に既に `safeBottom` を含む bottomNav を配置しているため、EAS build で `insets.bottom` が Expo Go より大きいと、bottom 余白が重なって「タブバーが上に浮いて見える」。

### 候補2: useSafeBottom と SafeAreaView の組み合わせ
`useSafeBottom(16)` は Android で `Math.max(insets.bottom, 16)` を返す。EAS build では `insets.bottom` が正しく取れている一方、Expo Go では 0 に近いことが多い。設定画面は SafeAreaView の bottom と bottomNav の safeBottom の両方を使っているため、build 時だけ「二重適用」が顕著になる。

### 候補3: bottomNav の height 計算と SafeAreaView の競合
bottomNav の `height: TAB_BAR_HEIGHT + ... + safeBottom` は、画面下端からのオフセットを意図している。しかし親の SafeAreaView が `edges={['bottom']}` で既に下端をインセットしているため、bottomNav は「インセットされた下端」にぴったり付く。Expo Go では `insets.bottom ≈ 0` のため問題になりにくく、build では `insets.bottom > 0` で余白が目立つ。

---

## 4. ログで事実確認（一時追加用コード）

```tsx
// 設定・ホームの両方で、コンポーネント先頭に追加
const insets = useSafeAreaInsets();
useEffect(() => {
  if (__DEV__) {
    const sb = require('react-native').StatusBar;
    console.log('[Layout]', {
      screen: 'settings', // or 'index'
      insetsBottom: insets.bottom,
      insetsTop: insets.top,
      platform: Platform.OS,
      statusBarHeight: sb?.currentHeight,
    });
  }
}, [insets.bottom, insets.top]);
```

`useSafeAreaFrame()` は `react-native-safe-area-context` から利用可能:

```tsx
import { useSafeAreaFrame } from 'react-native-safe-area-context';
const frame = useSafeAreaFrame();
console.log('frame.height', frame.height);
```

---

## 5. 修正方針（合意した案）

- **設定画面で SafeAreaView の `edges` を `['top']` のみに変更**
- **bottom は bottomNav の `safeBottom` のみで管理**
- ScrollView の `paddingBottom: safeBottom + 120` は、bottomNav の高さ分の余白として維持（safeBottom は bottomNav が使う値と揃える）
