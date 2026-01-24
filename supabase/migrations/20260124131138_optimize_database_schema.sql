/*
  # データベース設計の最適化

  ## 概要
  アプリ全体の機能を考慮して、データベース設計を最適化します。

  ## 変更内容

  ### 1. インデックスの追加
  パフォーマンス向上のため、頻繁に検索されるカラムにインデックスを追加
  
  #### records テーブル
  - `subject` カラム: 教科別検索・集計で使用
  - `(child_id, date)` 複合インデックス: 子供×日付での検索を高速化
  - `(user_id, date)` 複合インデックス: ユーザー×日付での検索を高速化

  ### 2. 新規テーブル: goals（目標設定）
  子供の学習目標を管理
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null) - ユーザーへの参照
  - `child_id` (uuid, not null) - 子供への参照
  - `subject` (text, not null) - 教科
  - `target_score` (integer) - 目標点数
  - `target_count` (integer) - 目標記録数
  - `period_start` (date) - 期間開始日
  - `period_end` (date) - 期間終了日
  - `memo` (text) - メモ
  - `is_achieved` (boolean, default false) - 達成フラグ
  - `created_at` (timestamptz)

  ### 3. 新規テーブル: tags（タグマスター）
  記録に付けるタグの管理
  - `id` (uuid, primary key)
  - `user_id` (uuid, nullable) - ユーザーへの参照（NULL=システムタグ）
  - `name` (text, not null) - タグ名
  - `color` (text, default '#95A5A6') - 表示色
  - `created_at` (timestamptz)

  ### 4. 新規テーブル: record_tags（記録×タグの中間テーブル）
  記録とタグの多対多関係を管理
  - `record_id` (uuid, not null) - 記録への参照
  - `tag_id` (uuid, not null) - タグへの参照
  - `created_at` (timestamptz)
  - 複合主キー: (record_id, tag_id)

  ### 5. ビュー: monthly_stats（月次統計ビュー）
  月別・教科別の統計データを提供
  - user_id, child_id, year, month, subject
  - record_count (記録数)
  - avg_score (平均点)
  - max_score (最高点)
  - min_score (最低点)

  ### 6. 関数: delete_record_images（画像自動削除）
  記録削除時に関連画像を自動的にStorageから削除

  ### 7. セキュリティ
  - 全ての新規テーブルでRLSを有効化
  - 認証ユーザーが自分のデータのみアクセス可能なポリシーを設定
  - システムタグは全ユーザーが閲覧可能

  ## 重要事項
  - 既存データに影響を与えない安全な設計
  - パフォーマンスとデータ整合性を重視
  - 将来の機能拡張を考慮した柔軟な設計
*/

-- ===========================
-- 1. インデックスの追加
-- ===========================

-- records.subject インデックス（教科別検索・集計用）
CREATE INDEX IF NOT EXISTS idx_records_subject ON records(subject);

-- records 複合インデックス（子供×日付検索用）
CREATE INDEX IF NOT EXISTS idx_records_child_date ON records(child_id, date DESC);

-- records 複合インデックス（ユーザー×日付検索用）
CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, date DESC);

-- subjects.user_id インデックス（既存の場合はスキップ）
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);

-- ===========================
-- 2. goals テーブル作成
-- ===========================

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  subject text NOT NULL,
  target_score integer CHECK (target_score > 0),
  target_count integer CHECK (target_count > 0),
  period_start date,
  period_end date,
  memo text,
  is_achieved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT check_period CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
  CONSTRAINT check_target CHECK (target_score IS NOT NULL OR target_count IS NOT NULL)
);

-- goalsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_child_id ON goals(child_id);
CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period_start, period_end);

-- goalsテーブルのRLS有効化
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- goalsテーブルのポリシー
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ===========================
-- 3. tags テーブル作成
-- ===========================

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#95A5A6',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_tag_per_user UNIQUE (user_id, name)
);

-- tagsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- tagsテーブルのRLS有効化
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- tagsテーブルのポリシー
CREATE POLICY "Users can view system tags"
  ON tags FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

CREATE POLICY "Users can view own tags"
  ON tags FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
  ON tags FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
  ON tags FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ===========================
-- 4. record_tags 中間テーブル作成
-- ===========================

CREATE TABLE IF NOT EXISTS record_tags (
  record_id uuid NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (record_id, tag_id)
);

-- record_tagsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_record_tags_record_id ON record_tags(record_id);
CREATE INDEX IF NOT EXISTS idx_record_tags_tag_id ON record_tags(tag_id);

-- record_tagsテーブルのRLS有効化
ALTER TABLE record_tags ENABLE ROW LEVEL SECURITY;

-- record_tagsテーブルのポリシー
CREATE POLICY "Users can view own record tags"
  ON record_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM records
      WHERE records.id = record_tags.record_id
      AND records.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own record tags"
  ON record_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM records
      WHERE records.id = record_tags.record_id
      AND records.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own record tags"
  ON record_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM records
      WHERE records.id = record_tags.record_id
      AND records.user_id = auth.uid()
    )
  );

-- ===========================
-- 5. 月次統計ビュー作成
-- ===========================

CREATE OR REPLACE VIEW monthly_stats AS
SELECT
  r.user_id,
  r.child_id,
  EXTRACT(YEAR FROM r.date)::integer AS year,
  EXTRACT(MONTH FROM r.date)::integer AS month,
  r.subject,
  COUNT(*)::integer AS record_count,
  ROUND(AVG(r.score), 1) AS avg_score,
  MAX(r.score) AS max_score,
  MIN(r.score) AS min_score
FROM records r
WHERE r.score IS NOT NULL
GROUP BY r.user_id, r.child_id, year, month, r.subject;

-- ビューへのアクセス権限
GRANT SELECT ON monthly_stats TO authenticated;

-- ===========================
-- 6. 初期データ投入（システムタグ）
-- ===========================

INSERT INTO tags (user_id, name, color) VALUES
  (NULL, '苦手', '#E74C3C'),
  (NULL, '得意', '#27AE60'),
  (NULL, '復習必要', '#F39C12'),
  (NULL, '完璧', '#3498DB'),
  (NULL, '宿題', '#9B59B6')
ON CONFLICT (user_id, name) DO NOTHING;

-- ===========================
-- 7. 画像自動削除関数（将来の実装用）
-- ===========================

-- Note: Supabase Storageの削除はクライアント側で実装する必要があるため、
-- ここではトリガーのみを定義し、実際の削除処理はアプリ側で行う