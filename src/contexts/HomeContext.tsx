import React, { createContext, useContext, useState } from 'react';

interface HomeContextValue {
  homeData: any | null;
  setHomeData: (d: any | null) => void;
}

const HomeContext = createContext<HomeContextValue | undefined>(undefined);

export const HomeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [homeData, setHomeData] = useState<any | null>(null);
  return <HomeContext.Provider value={{ homeData, setHomeData }}>{children}</HomeContext.Provider>;
};

export function useHome() {
  const ctx = useContext(HomeContext);
  if (!ctx) throw new Error('useHome must be used within HomeProvider');
  return ctx;
}

export default HomeContext;

