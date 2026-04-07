import type { SchoolLevel } from '@/lib/subjects';

type GradeFromBirthDate = {
  schoolLevel: SchoolLevel;
  grade: number;
  schoolYear: number;
};

function parseYmd(value: string): Date | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function getSchoolYear(baseDate: Date): number {
  // 日本の学校年度（4月始まり）
  const month = baseDate.getMonth() + 1;
  return month >= 4 ? baseDate.getFullYear() : baseDate.getFullYear() - 1;
}

function isOnOrAfterApr2(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return month > 4 || (month === 4 && day >= 2);
}

function mapElementaryGradeToLevel(elementaryGrade: number): { schoolLevel: SchoolLevel; grade: number } | null {
  if (elementaryGrade >= 1 && elementaryGrade <= 6) {
    return { schoolLevel: 'elementary', grade: elementaryGrade };
  }
  if (elementaryGrade >= 7 && elementaryGrade <= 9) {
    return { schoolLevel: 'junior_high', grade: elementaryGrade - 6 };
  }
  if (elementaryGrade >= 10 && elementaryGrade <= 12) {
    return { schoolLevel: 'high_school', grade: elementaryGrade - 9 };
  }
  return null;
}

function getElementaryOffset(level: SchoolLevel): number {
  switch (level) {
    case 'junior_high':
      return 6;
    case 'high_school':
      return 9;
    default:
      return 0;
  }
}

export function inferGradeFromBirthDate(
  birthDateYmd: string,
  baseDate: Date = new Date()
): GradeFromBirthDate | null {
  const birthDate = parseYmd(birthDateYmd);
  if (!birthDate) return null;

  const schoolYear = getSchoolYear(baseDate);
  const entranceYear = birthDate.getFullYear() + (isOnOrAfterApr2(birthDate) ? 7 : 6);
  const elementaryGrade = schoolYear - entranceYear + 1;
  const mapped = mapElementaryGradeToLevel(elementaryGrade);
  if (!mapped) return null;

  return {
    schoolLevel: mapped.schoolLevel,
    grade: mapped.grade,
    schoolYear,
  };
}

type ResolveSchoolInfoInput = {
  birthDate?: string | null;
  schoolLevel?: SchoolLevel | string | null;
  grade?: number | string | null;
  baseDate?: Date;
};

function normalizeSchoolLevel(value: ResolveSchoolInfoInput['schoolLevel']): SchoolLevel | null {
  if (value === 'elementary' || value === 'junior_high' || value === 'high_school') {
    return value;
  }
  return null;
}

function normalizeGrade(value: ResolveSchoolInfoInput['grade']): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function resolveCurrentSchoolInfo(input: ResolveSchoolInfoInput): {
  schoolLevel: SchoolLevel | null;
  grade: number | null;
  isFromBirthDate: boolean;
} {
  const inferred = inferGradeFromBirthDate(input.birthDate ?? '', input.baseDate ?? new Date());
  if (inferred) {
    return {
      schoolLevel: inferred.schoolLevel,
      grade: inferred.grade,
      isFromBirthDate: true,
    };
  }
  return {
    schoolLevel: normalizeSchoolLevel(input.schoolLevel),
    grade: normalizeGrade(input.grade),
    isFromBirthDate: false,
  };
}

export function getDefaultBirthDateForGrade(
  schoolLevel: SchoolLevel,
  grade: number,
  baseDate: Date = new Date()
): string {
  const schoolYear = getSchoolYear(baseDate);
  const elementaryGrade = grade + getElementaryOffset(schoolLevel);
  const entranceYear = schoolYear - elementaryGrade + 1;
  const birthYear = entranceYear - 7;
  return `${birthYear}-04-02`;
}

