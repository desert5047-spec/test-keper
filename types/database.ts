export type RecordType = 'テスト' | 'プリント' | 'ドリル' | '確認';
export type StampType = '大変よくできました' | 'よくできました' | 'がんばりました';
export type StampValue = StampType | string;

export interface Child {
  id: string;
  name: string | null;
  grade: string | null;
  color: string;
  is_default: boolean;
  user_id: string;
  created_at: string;
}

export interface TestRecord {
  id: string;
  child_id: string | null;
  date: string;
  subject: string;
  type: RecordType;
  score: number | null;
  max_score: number;
  stamp: string | null;
  memo: string | null;
  photo_uri: string | null;
  photo_rotation: 0 | 90 | 180 | 270;
  user_id: string;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  user_id: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  child_id: string;
  subject: string;
  target_score: number | null;
  target_count: number | null;
  period_start: string | null;
  period_end: string | null;
  memo: string | null;
  is_achieved: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string | null;
  name: string;
  color: string;
  created_at: string;
}

export interface RecordTag {
  record_id: string;
  tag_id: string;
  created_at: string;
}

export interface MonthlyStat {
  user_id: string;
  child_id: string;
  year: number;
  month: number;
  subject: string;
  record_count: number;
  avg_score: number | null;
  max_score: number | null;
  min_score: number | null;
}

export type Database = {
  public: {
    Tables: {
      children: {
        Row: Child;
        Insert: Omit<Child, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Child, 'id' | 'created_at'>>;
        Relationships: [];
      };
      records: {
        Row: TestRecord;
        Insert: Omit<TestRecord, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<TestRecord, 'id' | 'created_at'>>;
        Relationships: [
          {
            foreignKeyName: 'records_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      subjects: {
        Row: Subject;
        Insert: Omit<Subject, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Subject, 'id' | 'created_at'>>;
        Relationships: [];
      };
      goals: {
        Row: Goal;
        Insert: Omit<Goal, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Goal, 'id' | 'created_at'>>;
        Relationships: [
          {
            foreignKeyName: 'goals_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      tags: {
        Row: Tag;
        Insert: Omit<Tag, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Tag, 'id' | 'created_at'>>;
        Relationships: [];
      };
      record_tags: {
        Row: RecordTag;
        Insert: RecordTag;
        Update: Partial<RecordTag>;
        Relationships: [
          {
            foreignKeyName: 'record_tags_record_id_fkey';
            columns: ['record_id'];
            referencedRelation: 'records';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'record_tags_tag_id_fkey';
            columns: ['tag_id'];
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      monthly_stats: {
        Row: MonthlyStat;
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
