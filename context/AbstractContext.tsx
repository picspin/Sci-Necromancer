import React, { createContext, useState, useContext, ReactNode } from 'react';
import { SavedAbstract } from '../types';

interface AbstractContextType {
  loadAbstract: (abstract: SavedAbstract) => void;
  abstractToLoad: SavedAbstract | null;
  clearLoadedAbstract: () => void;
}

const AbstractContext = createContext<AbstractContextType>({
  loadAbstract: () => {},
  abstractToLoad: null,
  clearLoadedAbstract: () => {}
});

export const useAbstractContext = () => useContext(AbstractContext);

export const AbstractProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [abstractToLoad, setAbstractToLoad] = useState<SavedAbstract | null>(null);

  const loadAbstract = (abstract: SavedAbstract) => {
    setAbstractToLoad(abstract);
  };

  const clearLoadedAbstract = () => {
    setAbstractToLoad(null);
  };

  return (
    <AbstractContext.Provider value={{ loadAbstract, abstractToLoad, clearLoadedAbstract }}>
      {children}
    </AbstractContext.Provider>
  );
};