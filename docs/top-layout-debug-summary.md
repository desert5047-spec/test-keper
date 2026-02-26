# TOP レイアウトズレ 修正サマリ

## 1. 差分の原因と修正（実施済み）

### 原因候補（修正済み）
1. **SafeAreaView edges の不一致**: ホーム edges=['bottom'] vs 設定 edges=['top'] → 両方 `edges={['top']}` に統一
2. **AppHeader の二重 top 適用**: edges top 時に headerRow の marginTop: insets.top で二重化 → `safeTopByParent` プロップで HEADER_HEIGHT のみに
3. **Android Text の余白**: includeFontPadding 等 → title に `includeFontPadding: false`, `textAlignVertical: 'center'`, `lineHeight: 22` を追加

### 変更内容
- **ホーム**: edges bottom → edges top、safeTopByParent={true}
- **設定**: 既に edges top、safeTopByParent={true} を追加
- **AppHeader**: safeTopByParent プロップ追加（edges top 時に高さ・margin を調整）

## 2. StatusBar
- 全画面共通: `StatusBar style="dark" backgroundColor={BG}`（_layout.tsx）

## 3. 注意
- デバッグ用ログ・視覚デバッグは削除済み
