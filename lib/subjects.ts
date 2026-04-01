export type SchoolLevel = 'elementary' | 'junior_high' | 'high_school';

/** UI に表示する学校区分。high_school は後日追加予定 */
export const SCHOOL_LEVELS: { value: SchoolLevel; label: string }[] = [
  { value: 'elementary', label: '小学生' },
  { value: 'junior_high', label: '中学生' },
  // { value: 'high_school', label: '高校生' },  // 後日追加
];

export function getGradesForLevel(level: SchoolLevel): { label: string; value: number }[] {
  switch (level) {
    case 'elementary':
      return Array.from({ length: 6 }, (_, i) => ({
        label: `${i + 1}年`,
        value: i + 1,
      }));
    case 'junior_high':
    case 'high_school':
      return Array.from({ length: 3 }, (_, i) => ({
        label: `${i + 1}年`,
        value: i + 1,
      }));
  }
}

export function getGradeDisplayLabel(level: SchoolLevel | null | undefined, grade: number | string | null | undefined): string {
  const g = typeof grade === 'string' ? parseInt(grade, 10) : grade;
  if (!g) return '';
  switch (level) {
    case 'junior_high':
      return `中学${g}年`;
    case 'high_school':
      return `高校${g}年`;
    default:
      return `小学${g}年`;
  }
}

const SUBJECT_COLOR_MAP: Record<string, string> = {
  '国語': '#E74C3C',
  '算数': '#3498DB',
  '数学': '#3498DB',
  '理科': '#27AE60',
  '社会': '#E67E22',
  '英語': '#8E44AD',
  '生活': '#9B59B6',
  '図工': '#F39C12',
  '音楽': '#1ABC9C',
  '体育': '#E91E63',
  '保健体育': '#E91E63',
  '美術': '#F39C12',
  '技術家庭': '#9B59B6',
};

const EXTRA_SUBJECT_COLOR = '#95A5A6';

export function getSubjectColor(subject: string): string {
  return SUBJECT_COLOR_MAP[subject] ?? EXTRA_SUBJECT_COLOR;
}

interface SubjectSet {
  main: string[];
  other: string[];
}

const ELEMENTARY_SUBJECTS: SubjectSet = {
  main: ['国語', '算数', '理科', '社会', '英語'],
  other: ['生活', '音楽', '体育'],
};

const SECONDARY_SUBJECTS: SubjectSet = {
  main: ['国語', '数学', '理科', '社会', '英語'],
  other: ['音楽', '美術', '保健体育', '技術家庭'],
};

export function getSubjectsForLevel(level: SchoolLevel | null | undefined): SubjectSet {
  switch (level) {
    case 'junior_high':
    case 'high_school':
      return SECONDARY_SUBJECTS;
    default:
      return ELEMENTARY_SUBJECTS;
  }
}
