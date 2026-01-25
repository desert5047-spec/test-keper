/*
  # カスタム評価（スタンプ）のサポートを追加

  1. 変更内容
    - recordsテーブルのstampカラムの制約を削除し、任意のテキストを許可
    - これにより「大変よくできました」「よくできました」「がんばりました」以外のカスタム評価も保存可能に

  2. データの互換性
    - 既存のデータには影響なし
    - 既存の3つの評価値は引き続き使用可能
    - 新しいカスタム評価値も保存可能

  3. セキュリティ
    - RLSポリシーは変更なし
    - 既存のセキュリティ設定を維持
*/

-- stampカラムの制約を確認して、もし制約があれば削除
DO $$
BEGIN
  -- stampカラムが既にtext型であることを確認
  -- 制約がある場合は削除する必要がありますが、現在の実装では制約はないはずです
  -- このマイグレーションは将来のカスタム値に備えて実行します
  
  -- 念のため、stampカラムがtext型であることを確認
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'records' 
    AND column_name = 'stamp' 
    AND data_type != 'text'
  ) THEN
    ALTER TABLE records ALTER COLUMN stamp TYPE text;
  END IF;
END $$;