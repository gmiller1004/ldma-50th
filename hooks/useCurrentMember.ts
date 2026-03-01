"use client";

import { useState, useEffect } from "react";

type Member = {
  contactId?: string;
  authenticated: boolean;
};

export function useCurrentMember() {
  const [member, setMember] = useState<Member | null>(null);

  useEffect(() => {
    fetch("/api/members/me")
      .then((res) => res.json())
      .then((data) =>
        setMember({
          contactId: data.contactId,
          authenticated: data.authenticated === true,
        })
      )
      .catch(() => setMember({ authenticated: false }));
  }, []);

  return member;
}
