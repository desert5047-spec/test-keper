-- children テーブルに school_level カラムを追加
-- 既存データは elementary（小学生）としてフォールバック
alter table public.children
  add column if not exists school_level text default 'elementary';

-- 既存レコードで null のものを elementary に更新
update public.children
  set school_level = 'elementary'
  where school_level is null;
