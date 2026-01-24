/*
  # 子供機能の段階的解放を実現するためのスキーマ変更

  ## 変更内容

  ### 1. recordsテーブルの変更
  - child_idカラムをNULLABLEに変更（初回ユーザーが子供登録なしで記録を残せるようにする）
  - 既存のFOREIGN KEY制約を削除して再作成

  ### 2. 初期データの調整
  - デフォルトの子供データを自動生成しない（ユーザーが1件目を記録後に解放）

  ## 重要事項
  - 既存データがある場合は影響を受けない
  - child_id = NULLの記録は「未割り当て」として扱う
  - 後から子供を追加して既存記録に紐づけることが可能
*/

-- 既存のFOREIGN KEY制約を削除
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'records_child_id_fkey'
    AND table_name = 'records'
  ) THEN
    ALTER TABLE records DROP CONSTRAINT records_child_id_fkey;
  END IF;
END $$;

-- child_idカラムをNULLABLEに変更
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'child_id'
  ) THEN
    ALTER TABLE records ALTER COLUMN child_id DROP NOT NULL;
  END IF;
END $$;

-- FOREIGN KEY制約を再作成（NULLを許可）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'records_child_id_fkey'
    AND table_name = 'records'
  ) THEN
    ALTER TABLE records 
    ADD CONSTRAINT records_child_id_fkey 
    FOREIGN KEY (child_id) 
    REFERENCES children(id) 
    ON DELETE SET NULL;
  END IF;
END $$;