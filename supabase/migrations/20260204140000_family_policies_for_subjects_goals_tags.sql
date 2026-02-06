/*
  # Align subjects/goals/tags/record_tags with family_id

  1. Add family_id columns and backfill where possible
  2. Replace user_id-based RLS with family_id-based RLS
  3. Update monthly_stats view to use family_id
*/

-- goals: add family_id and backfill from children
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS family_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'goals_family_id_fkey'
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_family_id_fkey
      FOREIGN KEY (family_id)
      REFERENCES public.families(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS goals_family_id_idx ON public.goals (family_id);

UPDATE public.goals g
SET family_id = c.family_id
FROM public.children c
WHERE g.family_id IS NULL
  AND g.child_id = c.id
  AND c.family_id IS NOT NULL;

-- tags: add family_id and backfill from user -> family_members
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS family_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_family_id_fkey'
  ) THEN
    ALTER TABLE public.tags
      ADD CONSTRAINT tags_family_id_fkey
      FOREIGN KEY (family_id)
      REFERENCES public.families(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tags_family_id_idx ON public.tags (family_id);

UPDATE public.tags t
SET family_id = (
  SELECT fm.family_id
  FROM public.family_members fm
  WHERE fm.user_id = t.user_id
  LIMIT 1
)
WHERE t.family_id IS NULL
  AND t.user_id IS NOT NULL;

-- subjects: add family_id and backfill from user -> family_members
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS family_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subjects_family_id_fkey'
  ) THEN
    ALTER TABLE public.subjects
      ADD CONSTRAINT subjects_family_id_fkey
      FOREIGN KEY (family_id)
      REFERENCES public.families(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS subjects_family_id_idx ON public.subjects (family_id);

UPDATE public.subjects s
SET family_id = (
  SELECT fm.family_id
  FROM public.family_members fm
  WHERE fm.user_id = s.user_id
  LIMIT 1
)
WHERE s.family_id IS NULL
  AND s.user_id IS NOT NULL;

-- Replace RLS policies (goals)
DROP POLICY IF EXISTS "Users can view own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can update own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON public.goals;

CREATE POLICY "Family members can view goals"
  ON public.goals FOR SELECT
  TO authenticated
  USING (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = goals.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can insert goals"
  ON public.goals FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = goals.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can update goals"
  ON public.goals FOR UPDATE
  TO authenticated
  USING (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = goals.family_id
        AND fm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = goals.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can delete goals"
  ON public.goals FOR DELETE
  TO authenticated
  USING (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = goals.family_id
        AND fm.user_id = auth.uid()
    )
  );

-- Replace RLS policies (tags)
DROP POLICY IF EXISTS "Users can view system tags" ON public.tags;
DROP POLICY IF EXISTS "Users can view own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags;

CREATE POLICY "Family members can view tags"
  ON public.tags FOR SELECT
  TO authenticated
  USING (
    (family_id IS NULL AND user_id IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = tags.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can insert tags"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = tags.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can update tags"
  ON public.tags FOR UPDATE
  TO authenticated
  USING (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = tags.family_id
        AND fm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = tags.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can delete tags"
  ON public.tags FOR DELETE
  TO authenticated
  USING (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = tags.family_id
        AND fm.user_id = auth.uid()
    )
  );

-- Replace RLS policies (record_tags)
DROP POLICY IF EXISTS "Users can view own record tags" ON public.record_tags;
DROP POLICY IF EXISTS "Users can insert own record tags" ON public.record_tags;
DROP POLICY IF EXISTS "Users can delete own record tags" ON public.record_tags;

CREATE POLICY "Family members can view record tags"
  ON public.record_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.records r
      JOIN public.tags t ON t.id = record_tags.tag_id
      WHERE r.id = record_tags.record_id
        AND (t.family_id IS NULL OR t.family_id = r.family_id)
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = r.family_id
            AND fm.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Family members can insert record tags"
  ON public.record_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.records r
      JOIN public.tags t ON t.id = record_tags.tag_id
      WHERE r.id = record_tags.record_id
        AND (t.family_id IS NULL OR t.family_id = r.family_id)
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = r.family_id
            AND fm.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Family members can delete record tags"
  ON public.record_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.records r
      JOIN public.tags t ON t.id = record_tags.tag_id
      WHERE r.id = record_tags.record_id
        AND (t.family_id IS NULL OR t.family_id = r.family_id)
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = r.family_id
            AND fm.user_id = auth.uid()
        )
    )
  );

-- Replace RLS policies (subjects)
DROP POLICY IF EXISTS "Users can view system subjects" ON public.subjects;
DROP POLICY IF EXISTS "Users can view own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Users can insert own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Users can update own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Users can delete own subjects" ON public.subjects;

CREATE POLICY "Family members can view subjects"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (
    (family_id IS NULL AND user_id IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = subjects.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can insert subjects"
  ON public.subjects FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = subjects.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can update subjects"
  ON public.subjects FOR UPDATE
  TO authenticated
  USING (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = subjects.family_id
        AND fm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = subjects.family_id
        AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can delete subjects"
  ON public.subjects FOR DELETE
  TO authenticated
  USING (
    family_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = subjects.family_id
        AND fm.user_id = auth.uid()
    )
  );

-- Update monthly_stats view to use family_id
DROP VIEW IF EXISTS public.monthly_stats;

CREATE VIEW public.monthly_stats AS
SELECT
  r.family_id,
  r.child_id,
  EXTRACT(YEAR FROM r.date)::integer AS year,
  EXTRACT(MONTH FROM r.date)::integer AS month,
  r.subject,
  COUNT(*)::integer AS record_count,
  ROUND(AVG(r.score), 1) AS avg_score,
  MAX(r.score) AS max_score,
  MIN(r.score) AS min_score
FROM public.records r
WHERE r.score IS NOT NULL
GROUP BY r.family_id, r.child_id, year, month, r.subject;

GRANT SELECT ON public.monthly_stats TO authenticated;
