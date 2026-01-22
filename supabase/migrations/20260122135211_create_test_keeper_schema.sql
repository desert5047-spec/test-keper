/*
  # テストキーパーアプリのデータベーススキーマ作成

  ## 新規テーブル

  ### 1. children（子どもテーブル）
  - id (uuid, primary key)
  - name (text, nullable) - 子どもの名前（ニックネーム可）
  - grade (text, nullable) - 学年
  - color (text) - 表示用のカラーコード
  - is_default (boolean) - デフォルトの子どもかどうか
  - created_at (timestamptz)

  ### 2. records（記録テーブル）
  - id (uuid, primary key)
  - child_id (uuid, foreign key) - 子どもへの参照
  - date (date) - テスト実施日
  - subject (text, not null) - 教科
  - type (text, not null) - 種類（テスト/プリント/ドリル/確認）
  - score (integer, nullable) - 点数
  - max_score (integer, default 100) - 満点
  - stamp (text, nullable) - スタンプ評価
  - memo (text, nullable) - メモ
  - photo_uri (text, nullable) - 写真のURI
  - photo_rotation (integer, default 0) - 写真の回転角度（0/90/180/270）
  - created_at (timestamptz)

  ### 3. subjects（教科テーブル）
  - id (uuid, primary key)
  - name (text, unique, not null) - 教科名
  - created_at (timestamptz)

  ## セキュリティ
  - 全テーブルでRLSを有効化
  - MVPでは全ユーザーが全データにアクセス可能なポリシーを設定

  ## 初期データ
  - デフォルトの教科リスト（国語、算数、生活、図工、音楽、体育、理科、社会）を追加
*/

-- children テーブル作成
CREATE TABLE IF NOT EXISTS children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  grade text,
  color text NOT NULL DEFAULT '#FF6B6B',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- records テーブル作成
CREATE TABLE IF NOT EXISTS records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  subject text NOT NULL,
  type text NOT NULL CHECK (type IN ('テスト', 'プリント', 'ドリル', '確認')),
  score integer CHECK (score >= 0),
  max_score integer NOT NULL DEFAULT 100,
  stamp text CHECK (stamp IN ('大変よくできました', 'よくできました', 'がんばりました')),
  memo text,
  photo_uri text,
  photo_rotation integer NOT NULL DEFAULT 0 CHECK (photo_rotation IN (0, 90, 180, 270)),
  created_at timestamptz DEFAULT now()
);

-- subjects テーブル作成
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_records_child_id ON records(child_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON records(date DESC);

-- RLS有効化
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- MVPポリシー（全ユーザーアクセス可能）
CREATE POLICY "Anyone can view children"
  ON children FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert children"
  ON children FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update children"
  ON children FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete children"
  ON children FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can view records"
  ON records FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert records"
  ON records FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update records"
  ON records FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete records"
  ON records FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can view subjects"
  ON subjects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert subjects"
  ON subjects FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 初期データ投入（デフォルト教科）
INSERT INTO subjects (name) VALUES
  ('国語'),
  ('算数'),
  ('生活'),
  ('図工'),
  ('音楽'),
  ('体育'),
  ('理科'),
  ('社会')
ON CONFLICT (name) DO NOTHING;