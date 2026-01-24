import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface Child {
  id: string;
  name: string | null;
  grade: number | null;
  color: string;
}

interface ChildContextType {
  selectedChildId: string | null;
  setSelectedChildId: (id: string) => void;
  children: Child[];
  selectedChild: Child | null;
  loadChildren: () => Promise<void>;
}

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export function ChildProvider({ children: childrenProp }: { children: ReactNode }) {
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);

  const loadChildren = async () => {
    const { data } = await supabase
      .from('children')
      .select('id, name, grade, color')
      .order('created_at');

    if (data && data.length > 0) {
      setChildren(data);
      if (!selectedChildId) {
        setSelectedChildIdState(data[0].id);
      }
    }
  };

  useEffect(() => {
    loadChildren();
  }, []);

  const setSelectedChildId = (id: string) => {
    setSelectedChildIdState(id);
  };

  const selectedChild = children.find(c => c.id === selectedChildId) || null;

  return (
    <ChildContext.Provider value={{
      selectedChildId,
      setSelectedChildId,
      children,
      selectedChild,
      loadChildren
    }}>
      {childrenProp}
    </ChildContext.Provider>
  );
}

export function useChild() {
  const context = useContext(ChildContext);
  if (context === undefined) {
    throw new Error('useChild must be used within a ChildProvider');
  }
  return context;
}
