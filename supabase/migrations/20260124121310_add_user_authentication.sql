/*
  # ユーザー認証機能の追加

  ## 概要
  Supabase Authを使用したユーザー認証機能を追加し、データを各ユーザーに紐付けます。

  ## 変更内容

  ### 1. テーブル構造の変更
  
  #### children テーブル
  - `user_id` (uuid) カラムを追加 - auth.users への参照
  - NOT NULL制約付き、既存データには仮のUUIDを設定
  
  #### records テーブル
  - `user_id` (uuid) カラムを追加 - auth.users への参照
  - NOT NULL制約付き、既存データには仮のUUIDを設定
  
  #### subjects テーブル
  - `user_id` (uuid) カラムを追加 - auth.users への参照
  - NULL許可（システム共通の教科は user_id が NULL）

  ### 2. セキュリティポリシーの更新
  
  全ての既存ポリシーを削除し、ユーザー認証ベースのポリシーに置き換え：
  
  #### children テーブル
  - ユーザーは自分の子供のみ閲覧・作成・更新・削除可能
  
  #### records テーブル
  - ユーザーは自分の記録のみ閲覧・作成・更新・削除可能
  
  #### subjects テーブル
  - 全ユーザーがシステム教科（user_id = NULL）を閲覧可能
  - ユーザーは自分のカスタム教科を閲覧・作成・更新・削除可能

  ### 3. インデックスの追加
  - 各テーブルの user_id カラムにインデックスを作成してクエリパフォーマンスを向上

  ## 重要事項
  - 既存データは仮のUUID（00000000-0000-0000-0000-000000000000）に紐付けられます
  - 認証機能実装後、ユーザーは自分のデータのみアクセス可能になります
  - システム教科は全ユーザーが共有します
*/

-- 既存のポリシーを全て削除
DROP POLICY IF EXISTS "Anyone can view children" ON children;
DROP POLICY IF EXISTS "Anyone can insert children" ON children;
DROP POLICY IF EXISTS "Anyone can update children" ON children;
DROP POLICY IF EXISTS "Anyone can delete children" ON children;

DROP POLICY IF EXISTS "Anyone can view records" ON records;
DROP POLICY IF EXISTS "Anyone can insert records" ON records;
DROP POLICY IF EXISTS "Anyone can update records" ON records;
DROP POLICY IF EXISTS "Anyone can delete records" ON records;

DROP POLICY IF EXISTS "Anyone can view subjects" ON subjects;
DROP POLICY IF EXISTS "Anyone can insert subjects" ON subjects;

-- children テーブルに user_id カラムを追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'children' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE children ADD COLUMN user_id uuid;
    
    -- 既存データに仮のUUIDを設定
    UPDATE children SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
    
    -- NOT NULL制約を追加
    ALTER TABLE children ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- records テーブルに user_id カラムを追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE records ADD COLUMN user_id uuid;
    
    -- 既存データに仮のUUIDを設定
    UPDATE records SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
    
    -- NOT NULL制約を追加
    ALTER TABLE records ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- subjects テーブルに user_id カラムを追加（NULL許可）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subjects' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE subjects ADD COLUMN user_id uuid;
  END IF;
END $$;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_children_user_id ON children(user_id);
CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);

-- children テーブルの新しいRLSポリシー
CREATE POLICY "Users can view own children"
  ON children FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own children"
  ON children FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own children"
  ON children FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own children"
  ON children FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- records テーブルの新しいRLSポリシー
CREATE POLICY "Users can view own records"
  ON records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records"
  ON records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own records"
  ON records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own records"
  ON records FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- subjects テーブルの新しいRLSポリシー
CREATE POLICY "Users can view system subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

CREATE POLICY "Users can view own subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subjects"
  ON subjects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subjects"
  ON subjects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subjects"
  ON subjects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
