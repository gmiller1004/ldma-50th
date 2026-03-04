"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type VipUpsellContextValue = {
  isOpen: boolean;
  openVipUpsell: () => void;
  closeVipUpsell: () => void;
};

const VipUpsellContext = createContext<VipUpsellContextValue | null>(null);

export function VipUpsellProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openVipUpsell = useCallback(() => setIsOpen(true), []);
  const closeVipUpsell = useCallback(() => setIsOpen(false), []);

  return (
    <VipUpsellContext.Provider
      value={{ isOpen, openVipUpsell, closeVipUpsell }}
    >
      {children}
    </VipUpsellContext.Provider>
  );
}

export function useVipUpsell() {
  const ctx = useContext(VipUpsellContext);
  if (!ctx) {
    throw new Error("useVipUpsell must be used within VipUpsellProvider");
  }
  return ctx;
}
