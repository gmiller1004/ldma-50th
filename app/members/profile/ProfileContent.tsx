"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Pickaxe, Camera, Loader2, Bell } from "lucide-react";

type Profile = {
  authenticated: boolean;
  memberNumber?: string;
  contactId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  phone?: string;
  otherStreet?: string;
  otherCity?: string;
  otherState?: string;
  otherPostalCode?: string;
  duesOwed?: number;
  maintenancePaidThru?: string;
  showMaintenance?: boolean;
  hideMaintenance?: boolean;
  isOnAutoPay?: boolean;
  maintenancePaymentUrl?: string | null;
  commentDigestEnabled?: boolean;
};

export function ProfileContent() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    phone: "",
    otherStreet: "",
    otherCity: "",
    otherState: "",
    otherPostalCode: "",
  });

  function loadProfile() {
    return fetch("/api/members/me")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        if (!data.authenticated) {
          window.location.href = "/members/login";
        } else {
          setForm({
            phone: data.phone ?? "",
            otherStreet: data.otherStreet ?? "",
            otherCity: data.otherCity ?? "",
            otherState: data.otherState ?? "",
            otherPostalCode: data.otherPostalCode ?? "",
          });
        }
      });
  }

  useEffect(() => {
    loadProfile()
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/members/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }

      setSaveSuccess(true);
      setEditing(false);
      await loadProfile();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError("Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/members/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      await loadProfile();
    } catch {
      setError("Upload failed");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleNotifyToggle(enabled: boolean) {
    setSavingNotify(true);
    setError(null);
    try {
      const res = await fetch("/api/members/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentDigestEnabled: enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Update failed");
        return;
      }
      await loadProfile();
    } catch {
      setError("Update failed");
    } finally {
      setSavingNotify(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[#e8e0d5]/60">
        Loading profile…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-lg text-red-200">
        {error}
      </div>
    );
  }

  if (!profile?.authenticated) {
    return null;
  }

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—";
  const address = [
    profile.otherStreet,
    [profile.otherCity, profile.otherState].filter(Boolean).join(", "),
    profile.otherPostalCode,
  ]
    .filter(Boolean)
    .join("\n") || "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-[#0f3d1e]/50 border-2 border-[#d4af37]/30 flex items-center justify-center shrink-0">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt=""
                width={96}
                height={96}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <Pickaxe className="w-12 h-12 text-[#d4af37]/60" strokeWidth={1.5} />
            )}
          </div>
          <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
              className="sr-only"
            />
            {uploadingAvatar ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <Camera className="w-8 h-8 text-white" />
            )}
          </label>
        </div>
        <div className="flex-1">
          <p className="text-sm text-[#e8e0d5]/70">
            Hover over your photo to change it. Shown on your community posts. Max 2MB, JPEG/PNG/WebP/GIF.
          </p>
        </div>
      </div>

      <div className="p-4 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[#e8e0d5]/60">Member number</dt>
            <dd className="font-medium text-[#e8e0d5]">{profile.memberNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-[#e8e0d5]/60">Email</dt>
            <dd className="font-medium text-[#e8e0d5]">{profile.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-[#e8e0d5]/60">Name</dt>
            <dd className="font-medium text-[#e8e0d5]">{fullName}</dd>
          </div>
          {!profile.hideMaintenance && profile.maintenancePaidThru != null && (
            <div>
              <dt className="text-sm text-[#e8e0d5]/60">Maintenance paid thru</dt>
              <dd className="font-medium text-[#e8e0d5]">{profile.maintenancePaidThru}</dd>
            </div>
          )}
          {profile.showMaintenance && profile.duesOwed != null && profile.duesOwed > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-[#e8e0d5]/60">Maintenance dues owed (current year)</dt>
              <dd className="font-medium text-[#e8e0d5]">${profile.duesOwed.toFixed(2)}</dd>
              <p className="mt-2 text-sm text-[#e8e0d5]/70">
                The balance shown is what you owe for the current calendar year.
              </p>
              {profile.isOnAutoPay ? (
                <p className="mt-1 text-sm text-[#e8e0d5]/60">
                  You&apos;re currently set up on AutoPay. Call (888) 465-3717 if you have questions about your balance due.
                </p>
              ) : (
                <p className="mt-1 text-sm text-[#e8e0d5]/60">
                  Call (888) 465-3717 to set up autopay or make a payment.
                </p>
              )}
            </div>
          )}
        </dl>

        {!editing ? (
          <>
            <div className="mt-4 pt-4 border-t border-[#d4af37]/20">
              <dt className="text-sm text-[#e8e0d5]/60">Phone</dt>
              <dd className="font-medium text-[#e8e0d5]">{profile.phone ?? "—"}</dd>
            </div>
            <div className="mt-4">
              <dt className="text-sm text-[#e8e0d5]/60">Shipping address</dt>
              <dd className="font-medium text-[#e8e0d5] whitespace-pre-line">{address}</dd>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-6 px-4 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
            >
              Edit contact info
            </button>
          </>
        ) : (
          <form onSubmit={handleSave} className="mt-4 pt-4 border-t border-[#d4af37]/20 space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm text-[#e8e0d5]/60 mb-1">Phone</label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
              />
            </div>
            <div>
              <label htmlFor="otherStreet" className="block text-sm text-[#e8e0d5]/60 mb-1">Shipping address</label>
              <input
                id="otherStreet"
                type="text"
                placeholder="Street"
                value={form.otherStreet}
                onChange={(e) => setForm((f) => ({ ...f, otherStreet: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50 mb-2"
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input
                  type="text"
                  placeholder="City"
                  value={form.otherCity}
                  onChange={(e) => setForm((f) => ({ ...f, otherCity: e.target.value }))}
                  className="px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={form.otherState}
                  onChange={(e) => setForm((f) => ({ ...f, otherState: e.target.value }))}
                  className="px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
                />
                <input
                  type="text"
                  placeholder="ZIP"
                  value={form.otherPostalCode}
                  onChange={(e) => setForm((f) => ({ ...f, otherPostalCode: e.target.value }))}
                  className="px-3 py-2 bg-[#0f0a06] border border-[#d4af37]/30 rounded-lg text-[#e8e0d5] placeholder-[#e8e0d5]/40 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
                />
              </div>
            </div>
            <p className="text-xs text-[#e8e0d5]/50">
              Updating your shipping address will save it separately from your billing address.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-[#e8e0d5]/80 hover:text-[#d4af37] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>

      {saveSuccess && (
        <div className="p-3 bg-green-950/50 border border-green-800/50 rounded-lg text-green-200 text-sm">
          Your contact info has been updated.
        </div>
      )}

      <div className="p-4 bg-[#0f0a06]/60 border border-[#d4af37]/20 rounded-lg">
        <h3 className="font-semibold text-[#f0d48f] flex items-center gap-2 mb-3">
          <Bell className="w-5 h-5" />
          Notifications
        </h3>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={profile.commentDigestEnabled ?? false}
            onChange={(e) => handleNotifyToggle(e.target.checked)}
            disabled={savingNotify}
            className="mt-1 w-4 h-4 rounded border-[#d4af37]/40 bg-[#1a120b] text-[#d4af37] focus:ring-[#d4af37]/50"
          />
          <span className="text-[#e8e0d5]">
            Email me a daily recap when someone comments on my posts (around 8pm Pacific). Only sent when there&apos;s activity.
          </span>
        </label>
      </div>

      <p className="text-sm text-[#e8e0d5]/50">
        To update your name or email, please call the LDMA office.
      </p>
    </div>
  );
}
