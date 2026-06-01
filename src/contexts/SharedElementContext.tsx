import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SharedElementContextType {
  startPosition: Position | null;
  endPosition: Position | null;
  isAnimating: boolean;
  setStartPosition: (position: Position | null) => void;
  setEndPosition: (position: Position | null) => void;
  setIsAnimating: (animating: boolean) => void;
  reset: () => void;
}

const SharedElementContext = createContext<SharedElementContextType | undefined>(undefined);

export const SharedElementProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [startPosition, setStartPosition] = useState<Position | null>(null);
  const [endPosition, setEndPosition] = useState<Position | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const reset = () => {
    setStartPosition(null);
    setEndPosition(null);
    setIsAnimating(false);
  };

  return (
    <SharedElementContext.Provider
      value={{
        startPosition,
        endPosition,
        isAnimating,
        setStartPosition,
        setEndPosition,
        setIsAnimating,
        reset,
      }}
    >
      {children}
    </SharedElementContext.Provider>
  );
};

export const useSharedElement = () => {
  const context = useContext(SharedElementContext);
  if (!context) {
    throw new Error('useSharedElement must be used within SharedElementProvider');
  }
  return context;
};

