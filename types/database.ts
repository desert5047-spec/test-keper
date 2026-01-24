export type RecordType = 'テスト' | 'プリント' | 'ドリル' | '確認';
export type StampType = '大変よくできました' | 'よくできました' | 'がんばりました';

export interface Child {
  id: string;
  name: string | null;
  grade: string | null;
  color: string;
  is_default: boolean;
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
  stamp: StampType | null;
  memo: string | null;
  photo_uri: string | null;
  photo_rotation: 0 | 90 | 180 | 270;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  created_at: string;
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
    };
    Views: {
      [_ in never]: never;
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
