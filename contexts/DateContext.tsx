import { createContext, useContext, useState, ReactNode } from 'react';

interface DateContextType {
  year: number;
  month: number;
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
  setYearMonth: (year: number, month: number) => void;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const setYearMonth = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };

  return (
    <DateContext.Provider value={{ year, month, setYear, setMonth, setYearMonth }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDateContext() {
  const context = useContext(DateContext);
  if (context === undefined) {
    throw new Error('useDateContext must be used within a DateProvider');
  }
  return context;
}
