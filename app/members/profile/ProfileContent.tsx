"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Pickaxe, Camera, Loader2, Bell, Users, HelpCircle, X, Plus, Info, ShoppingBag, Sparkles } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { getCompanionAddOnProduct } from "@/app/actions/membership";
import { deriveLegacyOfferType, getLegacyOfferConfig, getLegacyOfferProductHandle } from "@/lib/legacy-offer";
import type { MembershipProductInfo } from "@/app/actions/membership";

function LegacyOfferModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-xl bg-[#1a120b] border border-[#d4af37]/30 shadow-xl"
        role="dialog"
        aria-labelledby="legacy-modal-title"
        aria-modal="true"
      >
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-[#d4af37]/20 bg-[#1a120b] z-10">
          <h2 id="legacy-modal-title" className="font-serif text-lg font-semibold text-[#f0d48f]">
            Build Your Family Legacy — Add-Ons Explained
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#e8e0d5]/60 hover:text-[#e8e0d5] hover:bg-[#d4af37]/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-[#e8e0d5]/90 text-sm">
            Three add-ons help you pass your LDMA membership on to family and keep the tradition going.
          </p>

          <section>
            <h3 className="font-semibold text-[#f0d48f] mb-2">Companion Add-On</h3>
            <p className="text-[#e8e0d5]/90 text-sm leading-relaxed">
              Lets a spouse, child over 18, parent, or grandparent prospect on LDMA claims and visit camps on their own—without you being there. They get their own membership privileges and can camp, prospect, and participate in events independently. Perfect for family members who want full access even when you&apos;re not around.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#f0d48f] mb-2">Transferability Add-On</h3>
            <p className="text-[#e8e0d5]/90 text-sm leading-relaxed">
              Lets you transfer your membership to a chosen heir when the time comes. Without transferability, your membership ends with you. With it, you designate who receives your membership—spouse, child, grandchild, or another family member—so they can continue prospecting and camping with LDMA. Transferability protects your investment and keeps the tradition alive in your family.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#f0d48f] mb-2">Pre-Paid Transfer Fee</h3>
            <p className="text-[#e8e0d5]/90 text-sm leading-relaxed">
              When a membership is transferred, the person receiving it typically pays a transfer fee. Pre-paying this fee means you cover it now, so your heir receives the membership with no fee when the time comes. It reduces the burden on them and makes it easier for the next generation to step into LDMA.
            </p>
          </section>

          <p className="text-[#e8e0d5]/70 text-sm pt-2 border-t border-[#d4af37]/20">
            To see which offers apply to your membership, close this and click <strong className="text-[#d4af37]">Request My Personalized Offer</strong>. We&apos;ll review your account and email you typically within 72 hours.
          </p>
        </div>
        <div className="sticky bottom-0 p-4 border-t border-[#d4af37]/20 bg-[#1a120b]">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const COMPANION_HELP_TEXT =
  "The Companion & Transferability add-on lets a spouse, child over 18, parent, or grandparent prospect on LDMA claims and visit camps independently. You can also transfer your membership to an heir.";

const COMPANION_BANNER_STORAGE_KEY = "ldma-companion-banner-expanded";

/** Hidden until Admin API is available for purchase history. Set to true when ready. */
const SHOW_PURCHASE_HISTORY_TAB = false;

/** Hidden for now. Set to true to show the Add Companion & Transferability card. */
const SHOW_COMPANION_ADD_ON_CARD = false;

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
  exclusiveOffersNotify?: boolean;
  companionTransferable?: boolean;
  companion?: string;
  legacyOfferRequestDate?: string | null;
  legacyOfferStatus?: string | null;
  legacyOfferIsTransferable?: boolean;
  legacyOfferIsCompanion?: boolean;
  legacyOfferIsPrePay?: boolean;
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
  const [companionProduct, setCompanionProduct] = useState<MembershipProductInfo | null>(null);
  const [bannerExpanded, setBannerExpanded] = useState(true);
  const [avatarHelpOpen, setAvatarHelpOpen] = useState(false);
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);
  const [legacyRequesting, setLegacyRequesting] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "purchase-history">(() => {
    if (SHOW_PURCHASE_HISTORY_TAB && typeof window !== "undefined" && window.location.hash === "#purchase-history") {
      return "purchase-history";
    }
    return "profile";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    phone: "",
    otherStreet: "",
    otherCity: "",
    otherState: "",
    otherPostalCode: "",
  });

  function loadProfile() {
    return fetch("/api/members/me", { cache: "no-store" })
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        setProfile(data);
        if (res.status === 401 || (res.ok && data.authenticated === false)) {
          window.location.href = "/members/login";
          return;
        }
        if (!res.ok) {
          setError("Failed to load profile");
          return;
        }
        if (data.authenticated) {
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

  useEffect(() => {
    if (profile?.authenticated && profile.companionTransferable === false) {
      getCompanionAddOnProduct().then(setCompanionProduct);
    }
  }, [profile?.authenticated, profile?.companionTransferable]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(COMPANION_BANNER_STORAGE_KEY);
    if (stored !== null) {
      setBannerExpanded(stored === "true");
    }
  }, []);

  useEffect(() => {
    if (!legacyModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLegacyModalOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [legacyModalOpen]);

  function setBannerExpandedWithStorage(expanded: boolean) {
    setBannerExpanded(expanded);
    if (typeof window !== "undefined") {
      localStorage.setItem(COMPANION_BANNER_STORAGE_KEY, String(expanded));
    }
  }

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

  async function handleLegacyOfferRequest() {
    setLegacyRequesting(true);
    setError(null);
    try {
      const res = await fetch("/api/members/legacy-offer-request", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      await loadProfile();
    } catch {
      setError("Request failed");
    } finally {
      setLegacyRequesting(false);
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

  async function handleExclusiveOffersNotifyToggle(enabled: boolean) {
    setSavingNotify(true);
    setError(null);
    try {
      const res = await fetch("/api/members/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exclusiveOffersNotify: enabled }),
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
  const showCompanionBanner = SHOW_COMPANION_ADD_ON_CARD && profile.companionTransferable === false;
  const showCompanionSection = profile.companionTransferable === true;
  const legacyOfferRequested = Boolean(profile.legacyOfferRequestDate);
  const legacyOfferCompleted =
    typeof profile.legacyOfferStatus === "string" &&
    profile.legacyOfferStatus.toLowerCase().includes("completed");
  const legacyOfferReviewed =
    typeof profile.legacyOfferStatus === "string" &&
    profile.legacyOfferStatus.toLowerCase().includes("reviewed");
  const legacyOfferType = legacyOfferReviewed
    ? deriveLegacyOfferType(
        profile.legacyOfferIsTransferable ?? false,
        profile.legacyOfferIsCompanion ?? false,
        profile.legacyOfferIsPrePay ?? false
      )
    : null;
  const legacyOfferConfig = legacyOfferType ? getLegacyOfferConfig(legacyOfferType) : null;

  const address = [
    profile.otherStreet,
    [profile.otherCity, profile.otherState].filter(Boolean).join(", "),
    profile.otherPostalCode,
  ]
    .filter(Boolean)
    .join("\n") || "—";

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-[#d4af37]/20 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeTab === "profile"
              ? "bg-[#d4af37]/20 text-[#f0d48f] border border-[#d4af37]/30 border-b-transparent -mb-[2px]"
              : "text-[#e8e0d5]/60 hover:text-[#e8e0d5] hover:bg-[#0f3d1e]/20"
          }`}
        >
          Profile
        </button>
        {SHOW_PURCHASE_HISTORY_TAB && (
          <button
            type="button"
            onClick={() => setActiveTab("purchase-history")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === "purchase-history"
                ? "bg-[#d4af37]/20 text-[#f0d48f] border border-[#d4af37]/30 border-b-transparent -mb-[2px]"
                : "text-[#e8e0d5]/60 hover:text-[#e8e0d5] hover:bg-[#0f3d1e]/20"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Purchase History
          </button>
        )}
      </div>

      {SHOW_PURCHASE_HISTORY_TAB && activeTab === "purchase-history" ? (
        <PurchaseHistoryTab />
      ) : (
      <>
      {!legacyOfferCompleted && (
      <div className="rounded-xl bg-[#0f3d1e]/40 border border-[#d4af37]/30 overflow-hidden">
        <div className="p-6">
          <h3 className="font-serif text-lg font-semibold text-[#f0d48f] flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-[#d4af37]" />
            {legacyOfferConfig ? legacyOfferConfig.headline : "Build Your Family Legacy"}
          </h3>
          {legacyOfferConfig ? (
            <>
              <p className="text-[#e8e0d5]/90 text-sm mb-3">{legacyOfferConfig.body}</p>
              <p className="text-[#d4af37] font-bold text-lg mb-4">
                {legacyOfferConfig.price}{" "}
                <span className="text-[#e8e0d5]/60 font-normal text-sm line-through">
                  {legacyOfferConfig.regularPrice}
                </span>
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <a
                  href={`/products/${getLegacyOfferProductHandle(legacyOfferType!)}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Purchase
                </a>
                <span className="px-2 py-2.5 text-[#e8e0d5]/60 text-sm">or</span>
                <a
                  href="tel:8884653717"
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#d4af37]/40 text-[#d4af37] font-medium rounded-lg hover:bg-[#d4af37]/10 transition-colors"
                >
                  Call (888) 465-3717 to Purchase
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="text-[#e8e0d5]/90 text-sm mb-3">
                Pass your LDMA membership on to a spouse, child, parent, or grandparent so they can prospect and visit camps on their own. With transferability, your membership outlives you—and the legacy keeps going for the next generation.
              </p>
              <p className="text-[#e8e0d5]/90 text-sm mb-4">
                We can also prepay the transfer fee so your heir receives the membership without paying it. You cover it now; they get the benefit later.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setLegacyModalOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-[#d4af37] border border-[#d4af37]/40 rounded-lg hover:bg-[#d4af37]/10 transition-colors"
                >
                  More Info
                </button>
                {legacyOfferRequested ? (
                  <p className="px-4 py-2 text-sm text-[#e8e0d5]/80">
                    We&apos;ve received your request. You&apos;ll hear from us typically within 72 hours.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleLegacyOfferRequest}
                    disabled={legacyRequesting}
                    className="px-5 py-2.5 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {legacyRequesting ? "Requesting…" : "Request My Personalized Offer"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {legacyModalOpen && (
        <LegacyOfferModal onClose={() => setLegacyModalOpen(false)} />
      )}

      {showCompanionBanner && (
        <div className="rounded-xl bg-[#0f3d1e]/40 border border-[#d4af37]/30 overflow-hidden">
          <div className="relative">
            {bannerExpanded ? (
              <div className="p-6">
                <button
                  type="button"
                  onClick={() => setBannerExpandedWithStorage(false)}
                  className="absolute top-4 right-4 p-1 rounded text-[#e8e0d5]/60 hover:text-[#e8e0d5] hover:bg-[#d4af37]/10 transition-colors"
                  aria-label="Minimize"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-8">
                  <div className="flex-1">
                    <h3 className="font-serif text-lg font-semibold text-[#f0d48f] flex items-center gap-2 mb-1">
                      <Users className="w-5 h-5 text-[#d4af37]" />
                      Add Companion & Transferability
                    </h3>
                    <p className="text-[#e8e0d5]/90 text-sm mb-2">
                      Let a spouse, child over 18, parent, or grandparent prospect on LDMA claims and visit camps independently. Transfer your membership to an heir — build a family legacy.
                    </p>
                    <p className="text-sm text-[#d4af37] font-medium">
                      $600 for a limited time <span className="text-[#e8e0d5]/70 line-through">(regularly $2,500)</span>
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {companionProduct ? (
                      <>
                        <AddToCartButton
                          variantId={companionProduct.variantId}
                          label="Add to Cart"
                          addingLabel="Adding…"
                          className="!w-auto"
                          trackCategory="membership"
                        />
                        <p className="text-xs text-[#e8e0d5]/60">or call (888) 465-3717</p>
                      </>
                    ) : (
                      <a
                        href="tel:8884653717"
                        className="inline-flex items-center gap-2 px-5 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
                      >
                        Call to Purchase
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setBannerExpandedWithStorage(true)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#0f3d1e]/60 transition-colors"
              >
                <h3 className="font-serif text-base font-semibold text-[#f0d48f] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#d4af37]" />
                  Add Companion & Transferability
                </h3>
                <span className="shrink-0 p-1 rounded text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors">
                  <Plus className="w-5 h-5" />
                </span>
              </button>
            )}
          </div>
        </div>
      )}

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
        <div className="flex-1 relative flex items-center group/help">
          <button
            type="button"
            onClick={() => setAvatarHelpOpen((o) => !o)}
            onBlur={() => setTimeout(() => setAvatarHelpOpen(false), 150)}
            className="p-1.5 rounded text-[#e8e0d5]/50 hover:text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors"
            aria-label="Profile photo help"
          >
            <Info className="w-5 h-5" />
          </button>
          <div
            className={`absolute left-0 top-full mt-2 z-10 px-3 py-2 rounded-lg bg-[#1a120b] border border-[#d4af37]/30 text-sm text-[#e8e0d5]/90 shadow-xl min-w-[200px] max-w-[280px] ${avatarHelpOpen ? "block" : "hidden group-hover/help:block"}`}
            role="tooltip"
          >
            Hover over your photo to change it. Shown on your community posts. Max 2MB, JPEG/PNG/WebP/GIF.
          </div>
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
          {showCompanionSection && (
            <div className="mt-4 pt-4 border-t border-[#d4af37]/20 sm:col-span-2">
              <dt className="text-sm text-[#e8e0d5]/60 flex items-center gap-1.5 mb-1">
                Companion
                {!profile.companion && (
                  <span
                    className="inline-flex text-[#d4af37]/70 cursor-help"
                    title={COMPANION_HELP_TEXT}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </span>
                )}
              </dt>
              {profile.companion ? (
                <dd className="font-medium text-[#e8e0d5]">{profile.companion}</dd>
              ) : (
                <dd className="text-[#e8e0d5]/90">
                  <span className="text-amber-400/90">Please call (888) 465-3717 to confirm your companion.</span>
                </dd>
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
        <label className="flex items-start gap-3 cursor-pointer mt-3">
          <input
            type="checkbox"
            checked={profile.exclusiveOffersNotify ?? false}
            onChange={(e) => handleExclusiveOffersNotifyToggle(e.target.checked)}
            disabled={savingNotify}
            className="mt-1 w-4 h-4 rounded border-[#d4af37]/40 bg-[#1a120b] text-[#d4af37] focus:ring-[#d4af37]/50"
          />
          <span className="text-[#e8e0d5]">
            Email me when new exclusive member offers are added (limited-time offers; at most once per day when there are new products).
          </span>
        </label>
      </div>

      <p className="text-sm text-[#e8e0d5]/50">
        To update your name or email, please call the LDMA office.
      </p>
      </>
      )}
    </div>
  );
}

type CustomerOrder = {
  id: string;
  name: string;
  orderNumber: number;
  processedAt: string;
  totalPrice: { amount: string; currencyCode: string };
  lineItems: Array<{
    title: string;
    quantity: number;
    originalTotalPrice: { amount: string };
  }>;
};

const SHOPIFY_OAUTH_MESSAGE = "shopify-oauth-complete";
const OAUTH_POPUP_NAME = "shopify-oauth";

function PurchaseHistoryTab() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);
  const popupRef = useRef<Window | null>(null);

  function loadPurchaseHistory(includeDebug = false) {
    setLoading(true);
    setDebug(null);
    fetch(`/api/members/purchase-history${includeDebug ? "?debug=1" : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setNeedsLogin(!!data.needsLogin);
        setOrders(data.orders ?? []);
        setError(data.error ?? null);
        if (includeDebug && (data._debug || data.errorMsg)) {
          setDebug({
            _debug: data._debug,
            errorMsg: data.errorMsg,
            memberNumber: data.memberNumber,
          });
        }
      })
      .catch(() => {
        setNeedsLogin(true);
        setError(null);
      })
      .finally(() => setLoading(false));
  }

  async function runTroubleshoot() {
    setDebug(null);
    const [statusRes, historyRes] = await Promise.all([
      fetch("/api/members/shopify-status"),
      fetch("/api/members/purchase-history?debug=1"),
    ]);
    const status = await statusRes.json();
    const history = await historyRes.json();
    setDebug({
      status,
      purchaseHistory: {
        _debug: history._debug,
        errorMsg: history.errorMsg,
        needsLogin: history.needsLogin,
        memberNumber: history.memberNumber,
      },
    });
  }

  function openShopifySignIn() {
    const popup = window.open(
      "/api/members/shopify-oauth/start",
      OAUTH_POPUP_NAME,
      "width=500,height=700,scrollbars=yes,resizable=yes"
    );
    popupRef.current = popup ?? null;
  }

  useEffect(() => {
    loadPurchaseHistory();
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== SHOPIFY_OAUTH_MESSAGE) return;
      if (e.data?.success) {
        popupRef.current?.close();
        popupRef.current = null;
        window.location.hash = "purchase-history";
        window.location.reload();
      } else {
        popupRef.current?.close();
        popupRef.current = null;
        loadPurchaseHistory();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-[#e8e0d5]/60">
        Loading purchase history…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-amber-950/30 border border-amber-700/30">
          <p className="text-sm text-amber-200">{error}</p>
        </div>
      )}

      {!needsLogin && (
        <div className="p-4 rounded-lg bg-[#0f3d1e]/30 border border-[#d4af37]/20">
          <p className="text-sm text-[#e8e0d5]/90">
            These details only include purchases made from the MyLDMA online store.
            If you have questions about purchases that don&apos;t appear here, call{" "}
            <a href="tel:8884653717" className="text-[#d4af37] hover:underline">(888) 465-3717</a>.
          </p>
        </div>
      )}

      {needsLogin ? (
        <div className="p-8 rounded-xl bg-[#0f0a06]/60 border border-[#d4af37]/20 text-center">
          <ShoppingBag className="w-12 h-12 text-[#d4af37]/50 mx-auto mb-4" />
          <p className="text-[#e8e0d5]/90 mb-4">
            Sign in with your MyLDMA store account to view your purchase history. You may receive a one-time code by email.
          </p>
          <button
            type="button"
            onClick={openShopifySignIn}
            className="px-6 py-3 bg-[#d4af37] text-[#1a120b] font-semibold rounded-lg hover:bg-[#f0d48f] transition-colors"
          >
            Sign in to Store
          </button>
          <p className="text-xs text-[#e8e0d5]/50 mt-3">
            If a window didn&apos;t open, your browser may have blocked the popup. Allow popups and try again.
          </p>
          <button
            type="button"
            onClick={runTroubleshoot}
            className="mt-4 text-xs text-[#e8e0d5]/40 hover:text-[#d4af37]/70 underline"
          >
            Troubleshoot connection
          </button>
          {debug && (
            <pre className="mt-2 p-3 text-xs bg-black/30 rounded overflow-auto max-h-32 text-[#e8e0d5]/80">
              {JSON.stringify(debug, null, 2)}
            </pre>
          )}
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="p-5 rounded-xl bg-[#0f0a06]/60 border border-[#d4af37]/20"
            >
              <div className="flex flex-wrap justify-between gap-2 mb-3">
                <span className="font-semibold text-[#f0d48f]">{order.name}</span>
                <span className="text-sm text-[#e8e0d5]/70">
                  {new Date(order.processedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-[#e8e0d5]/90 mb-3">
                {order.lineItems.map((item, i) => (
                  <li key={i}>
                    {item.quantity}× {item.title} — ${parseFloat(item.originalTotalPrice.amount).toFixed(2)}
                  </li>
                ))}
              </ul>
              <p className="text-[#d4af37] font-semibold">
                Total: ${parseFloat(order.totalPrice.amount).toFixed(2)} {order.totalPrice.currencyCode}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-xl bg-[#0f0a06]/60 border border-[#d4af37]/20 text-center text-[#e8e0d5]/70">
          No orders found.
          {error && (
            <>
              <p className="mt-3 text-sm text-[#e8e0d5]/60">
                If you previously connected your store, try disconnecting and signing in again.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch("/api/members/shopify-disconnect", { method: "POST" });
                  if (res.ok) {
                    setDebug(null);
                    loadPurchaseHistory();
                  }
                }}
                className="mt-3 px-4 py-2 text-sm bg-[#d4af37]/20 text-[#d4af37] rounded-lg hover:bg-[#d4af37]/30 transition-colors"
              >
                Disconnect store & sign in again
              </button>
              <button
                type="button"
                onClick={runTroubleshoot}
                className="mt-4 block mx-auto text-xs text-[#e8e0d5]/40 hover:text-[#d4af37]/70 underline"
              >
                Troubleshoot connection
              </button>
              {debug && (
                <pre className="mt-3 p-3 text-left text-xs bg-black/30 rounded overflow-auto max-h-40 text-[#e8e0d5]/80">
                  {JSON.stringify(debug, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
