"use client";

import { useEffect, useState } from "react";

export function useCartCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/cart")
      .then((res) => res.json())
      .then((data) => setCount(data.count ?? 0))
      .catch(() => setCount(0));
  }, []);

  return count;
}

export function CartBadge() {
  const count = useCartCount();
  if (count <= 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-[#d4af37] text-[#1a120b] rounded-full">
      {count}
    </span>
  );
}
