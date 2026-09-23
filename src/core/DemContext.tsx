// src/core/DemContext.tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import type { DemData } from "./dem";

interface Ctx {
  dem: DemData | null;
  setDem: (d: DemData | null) => void;
}

const DemContext = createContext<Ctx>({ dem: null, setDem: () => {} });

export function DemProvider({ children }: { children: ReactNode }) {
  const [dem, setDem] = useState<DemData | null>(null);
  return (
    <DemContext.Provider value={{ dem, setDem }}>
      {children}
    </DemContext.Provider>
  );
}

export const useDem = () => useContext(DemContext);