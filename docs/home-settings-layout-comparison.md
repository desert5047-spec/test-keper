# ホーム vs 設定 レイアウト比較（縦方向のみ）

## 1. ルートコンポーネント

| 項目 | ホーム | 設定 |
|------|--------|------|
| SafeAreaView | ✅ | ✅ |
| edges | `['bottom']` | `['top']` |
| style paddingTop/Bottom | なし | なし |
| useSafeAreaInsets | ❌（useHeaderTop 経由） | ✅ 直接使用 |
| insets.top の使用箇所 | useHeaderTop → headerTop + 8 | paddingTop: insets.top + HEADER_HEIGHT + 12 |
| insets.bottom の使用箇所 | SafeAreaView edges bottom で自動 | ❌（bottomNav の safeBottom のみ） |
| SafeAreaView + insets 併用 | useHeaderTop (= insets.top + 52) | insets.top + 52 を直接 |

## 2. ScrollView / FlatList contentContainerStyle

| 項目 | ホーム | 設定 |
|------|--------|------|
| paddingTop | `headerTop + 8` = insets.top + 60 | `insets.top + HEADER_HEIGHT + 12` = insets.top + 64 |
| paddingBottom | `24` | `BOTTOM_NAV_BASE_HEIGHT + 24` = 104 |

※ listContent の padding: 16 は paddingTop で上書き済み

## 3. TabBar / bottomNav

| 項目 | ホーム (Tabs) | 設定 (bottomNav) |
|------|---------------|------------------|
| height | 80 + safeBottom | 80 + safeBottom |
| paddingBottom | 8 + safeBottom | 8 + safeBottom |
| 描画元 | (tabs)/_layout tabBar | 自前 View |

## 4. 差分まとめ

### ホームだけにある余白
- **SafeAreaView edges bottom** → コンテンツ下端に `insets.bottom` 分のパディング
- コンテンツと TabBar の間の実質余白: `24 + insets.bottom`（listContent の paddingBottom 24 + SafeArea による下端インセット）

### 設定だけにある余白
- **paddingTop が 4px 多い** → `insets.top + 64` vs `insets.top + 60`（12 vs 8 の差）
- **SafeAreaView edges top のみ** → bottom は触らない（正解パターン）

### 構造上の違い（揃えられない部分）
- ホーム: TabBar は Tabs が描画、FlatList の paddingBottom は「リスト下端余白」の 24 のみ
- 設定: bottomNav が ScrollView と兄弟、コンテンツが隠れないよう paddingBottom に bottomNav 高さ分 (80) + 24 が必要

## 5. 計算（top 差分）

| 画面 | paddingTop の実値 |
|------|-------------------|
| ホーム | insets.top + 60 |
| 設定 | insets.top + 64 |
| **差分** | **4px**（設定の方が下に多い） |

## 6. 修正方針（実施済み）

設定の paddingTop をホームに合わせる:
- `insets.top + HEADER_HEIGHT + 12` → `useHeaderTop() + 8` (= insets.top + 60) ✓
- useSafeAreaInsets の直接使用をやめ、useHeaderTop に統一
