"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  BarChart3,
  Building2,
  Check,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  Download,
  Gauge,
  Gift,
  Megaphone,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ScreenHeader, YzLoader, fmtShort, fmtSum, useToast } from "@/components/yz";
import { apiBase, apiFetch, getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RevenueChart } from "../analytics/RevenueChart";

type Summary = {
  businesses_total: number;
  businesses_active: number;
  businesses_new_7d: number;
  active_subscriptions: number;
  trial_subscriptions: number;
  paid_subscriptions: number;
  mrr_uzs: number;
  revenue_7d_uzs: number;
  pending_card_payments: number;
};

type Biz = {
  id: string;
  name: string;
  slug: string;
  category: string;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
  owner: { telegram_id: number | null; name: string };
  subscription: { plan: string | null; expires_at: string | null } | null;
};

const BIZ_CATEGORIES = [
  "barbershop",
  "salon",
  "dentist",
  "tutor",
  "photo",
  "massage",
  "fitness",
  "clinic",
  "other",
] as const;

type BizFormState = {
  id: string | null;
  name: string;
  slug: string;
  category: string;
  owner_telegram_id: string;
  owner_first_name: string;
  owner_phone: string;
  description: string;
  address: string;
  phone: string;
};

const SUB_PLANS = ["TRIAL", "MONTHLY", "YEARLY"] as const;
const SUB_STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED"] as const;

type SubFormState = {
  business_id: string;
  business_name: string;
  subscription_id: string;
  plan: string;
  status: string;
  expires_at: string;
};

const EMPTY_BIZ_FORM: BizFormState = {
  id: null,
  name: "",
  slug: "",
  category: "other",
  owner_telegram_id: "",
  owner_first_name: "",
  owner_phone: "",
  description: "",
  address: "",
  phone: "",
};

type Pending = {
  transaction_id: string;
  business_id: string;
  business_name: string;
  amount: number;
  plan: string;
  status: string;
  user_comment: string;
  screenshot_url: string;
  created_at: string;
};

type CardInfo = { card_number: string; card_holder: string; payment_comment: string };

type PlanPrices = {
  monthly: number;
  yearly: number;
  monthly_override: number;
  yearly_override: number;
};

type AdminPayment = {
  id: string;
  business_name: string;
  business_id: string;
  provider: string;
  amount: number;
  plan: string;
  status: string;
  created_at: string;
};

type Tab =
  | "summary"
  | "businesses"
  | "payments"
  | "reviews"
  | "system"
  | "broadcast"
  | "settings"
  | "backup"
  | "audit";

const TABS: { k: Tab; label: string; icon: typeof Shield }[] = [
  { k: "summary", label: "Statistika", icon: BarChart3 },
  { k: "businesses", label: "Bizneslar", icon: Building2 },
  { k: "payments", label: "To‘lovlar", icon: Wallet },
  { k: "reviews", label: "Sharhlar", icon: Star },
  { k: "system", label: "Tizim", icon: Gauge },
  { k: "settings", label: "Karta", icon: CreditCard },
  { k: "broadcast", label: "Xabar", icon: Megaphone },
  { k: "backup", label: "Backup", icon: Database },
  { k: "audit", label: "Tarix", icon: ClipboardList },
];

type Metrics = {
  days: number;
  growth: { day: string; value: number }[];
  revenue: { day: string; value: number }[];
  arpu_uzs: number;
  paying_businesses: number;
  conversion_pct: number;
  churned_subscriptions: number;
  expiring_7d: number;
};

type Expiring = {
  business_id: string;
  business_name: string;
  plan: string;
  expires_at: string;
  days_left: number;
  owner: { telegram_id: number | null; name: string };
};

type ReviewItem = {
  id: string;
  business_id: string;
  business_name: string;
  rating: number;
  comment: string;
  owner_reply: string;
  client_name: string;
  created_at: string;
};

type Activity = {
  business_id: string;
  bookings_total: number;
  bookings_30d: number;
  bookings_by_status: Record<string, number>;
  clients_total: number;
  revenue_total_uzs: number;
  reviews_count: number;
  reviews_avg: number | null;
};

type ActivityModalState = { businessName: string; data: Activity | null };

type PlatformStats = {
  referrals_total: number;
  referrals_completed: number;
  referral_conversion_pct: number;
  waitlist_total: number;
  waitlist_waiting: number;
  promo_total: number;
  promo_active: number;
  promo_uses: number;
  bookings_total: number;
  clients_total: number;
  reviews_total: number;
  reviews_avg: number | null;
  last_backup: { name: string; size_kb: number; modified_at: string } | null;
};

type AdminItem = {
  telegram_id: number;
  name: string;
  source: "env" | "db";
  removable: boolean;
  created_at: string | null;
};

type AuditEntry = {
  id: string;
  admin_telegram_id: number;
  admin_name: string;
  action: string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type BroadcastHistory = {
  id: string;
  sent_by_telegram_id: number;
  sent_by_name: string;
  text: string;
  filters: Record<string, unknown>;
  sent_count: number;
  failed_count: number;
  failed_recipients: number[];
  created_at: string;
};

type BroadcastFiltersState = {
  category: string;
  plan: string;
  subscription_status: string;
};

const EMPTY_BROADCAST_FILTERS: BroadcastFiltersState = {
  category: "",
  plan: "",
  subscription_status: "",
};

export default function AdminPage() {
  const toast = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [sum, setSum] = useState<Summary | null>(null);
  const [biz, setBiz] = useState<Biz[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [recent, setRecent] = useState<AdminPayment[]>([]);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [card, setCard] = useState<CardInfo>({ card_number: "", card_holder: "", payment_comment: "" });
  const [broadcastText, setBroadcastText] = useState("");
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [backupBusy, setBackupBusy] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [bizForm, setBizForm] = useState<BizFormState | null>(null);
  const [bizSaving, setBizSaving] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [subForm, setSubForm] = useState<SubFormState | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>("");
  const [broadcastFilters, setBroadcastFilters] = useState<BroadcastFiltersState>(
    EMPTY_BROADCAST_FILTERS
  );
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastHistory[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [expiring, setExpiring] = useState<Expiring[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsMaxRating, setReviewsMaxRating] = useState<string>("");
  const [bizQuery, setBizQuery] = useState("");
  const [bizSearch, setBizSearch] = useState("");
  const [bizCategory, setBizCategory] = useState("");
  const [bizSub, setBizSub] = useState("");
  const [exportingPayments, setExportingPayments] = useState(false);
  const [activity, setActivity] = useState<ActivityModalState | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [prices, setPrices] = useState<{ monthly: string; yearly: string }>({
    monthly: "",
    yearly: "",
  });
  const [savingPrices, setSavingPrices] = useState(false);
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => {
    apiFetch<{ is_admin?: boolean }>("/api/auth/me")
      .then((u) => setIsAdmin(!!u?.is_admin))
      .catch(() => setIsAdmin(false));
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      setSum(await apiFetch<Summary>("/api/admin/summary"));
    } catch (e) {
      toast(`Statistika yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
    }
  }, [toast]);

  const loadBusinesses = useCallback(async () => {
    const params = new URLSearchParams();
    if (showDeleted) params.set("include_deleted", "true");
    if (bizSearch.trim()) params.set("q", bizSearch.trim());
    if (bizCategory) params.set("category", bizCategory);
    if (bizSub) params.set("sub", bizSub);
    const qs = params.toString() ? `?${params.toString()}` : "";
    try {
      setBiz(await apiFetch<Biz[]>(`/api/admin/businesses${qs}`));
    } catch (e) {
      toast(`Bizneslar yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
    }
  }, [toast, showDeleted, bizSearch, bizCategory, bizSub]);

  const loadPending = useCallback(async () => {
    let list: Pending[] = [];
    try {
      list = await apiFetch<Pending[]>("/api/payments/pending");
    } catch (e) {
      toast(`To'lovlar yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
      return;
    }
    setPending(list);
    const token = getToken();
    const urls: Record<string, string> = {};
    await Promise.all(
      list.map(async (p) => {
        if (!p.screenshot_url) return;
        try {
          const res = await fetch(`${apiBase()}${p.screenshot_url}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) urls[p.transaction_id] = URL.createObjectURL(await res.blob());
        } catch {
          // screenshot fetch failure is non-fatal — admin can still approve/reject
        }
      })
    );
    setImageUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  }, [toast]);

  const loadCard = useCallback(async () => {
    try {
      setCard(await apiFetch<CardInfo>("/api/payments/card/info"));
    } catch {
      // optional: card may not be configured yet
    }
  }, []);

  const loadPrices = useCallback(async () => {
    try {
      const p = await apiFetch<PlanPrices>("/api/admin/plan-prices");
      setPrices({
        monthly: p.monthly_override ? String(p.monthly_override) : "",
        yearly: p.yearly_override ? String(p.yearly_override) : "",
      });
    } catch {
      // prices fall back to code defaults if unreadable
    }
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      setRecent(await apiFetch<AdminPayment[]>("/api/admin/payments?limit=50"));
    } catch (e) {
      toast(`Tarix yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
    }
  }, [toast]);

  const loadAudit = useCallback(async () => {
    const qs = auditFilter ? `?action=${encodeURIComponent(auditFilter)}` : "";
    try {
      setAudit(await apiFetch<AuditEntry[]>(`/api/admin/audit-log${qs}`));
    } catch (e) {
      toast(`Tarix yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
    }
  }, [toast, auditFilter]);

  const loadMetrics = useCallback(async () => {
    try {
      setMetrics(await apiFetch<Metrics>("/api/admin/metrics?days=30"));
    } catch {
      // metrics are a nice-to-have; the summary cards still render without them
    }
  }, []);

  const loadExpiring = useCallback(async () => {
    try {
      setExpiring(await apiFetch<Expiring[]>("/api/admin/subscriptions/expiring?days=7"));
    } catch {
      // non-fatal
    }
  }, []);

  const loadReviews = useCallback(async () => {
    const qs = reviewsMaxRating ? `?max_rating=${reviewsMaxRating}` : "";
    try {
      setReviews(await apiFetch<ReviewItem[]>(`/api/admin/reviews${qs}`));
    } catch (e) {
      toast(`Sharhlar yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
    }
  }, [toast, reviewsMaxRating]);

  const loadPlatformStats = useCallback(async () => {
    try {
      setPlatformStats(await apiFetch<PlatformStats>("/api/admin/platform-stats"));
    } catch (e) {
      toast(`Tizim yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
    }
  }, [toast]);

  const loadAdmins = useCallback(async () => {
    try {
      setAdmins(await apiFetch<AdminItem[]>("/api/admin/admins"));
    } catch {
      // non-fatal
    }
  }, []);

  const loadBroadcastHistory = useCallback(async () => {
    try {
      setBroadcastHistory(
        await apiFetch<BroadcastHistory[]>("/api/admin/broadcasts?limit=30")
      );
    } catch (e) {
      toast(`Tarix yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) return;
    loadSummary();
    loadBusinesses();
    loadPending();
    loadRecent();
    loadCard();
    loadPrices();
    loadMetrics();
    loadExpiring();
  }, [
    isAdmin,
    loadSummary,
    loadBusinesses,
    loadPending,
    loadRecent,
    loadCard,
    loadPrices,
    loadMetrics,
    loadExpiring,
  ]);

  useEffect(() => {
    if (!isAdmin || tab !== "audit") return;
    loadAudit();
  }, [isAdmin, tab, loadAudit]);

  useEffect(() => {
    if (!isAdmin || tab !== "reviews") return;
    loadReviews();
  }, [isAdmin, tab, loadReviews]);

  useEffect(() => {
    if (!isAdmin || tab !== "system") return;
    loadPlatformStats();
    loadAdmins();
  }, [isAdmin, tab, loadPlatformStats, loadAdmins]);

  useEffect(() => {
    if (!isAdmin || tab !== "broadcast") return;
    loadBroadcastHistory();
  }, [isAdmin, tab, loadBroadcastHistory]);

  // Free blob URLs on unmount to avoid memory leak when admin navigates away.
  useEffect(() => {
    return () => {
      setImageUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, []);

  async function extend(business_id: string, days: number) {
    try {
      await apiFetch("/api/admin/subscription/extend", {
        method: "POST",
        body: JSON.stringify({ business_id, days }),
      });
      toast(`+${days} kun qo‘shildi`);
      await Promise.all([loadBusinesses(), loadExpiring()]);
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Uzaytirish xatolik");
    }
  }

  async function toggleBiz(business_id: string, is_active: boolean) {
    try {
      await apiFetch("/api/admin/business/toggle", {
        method: "POST",
        body: JSON.stringify({ business_id, is_active }),
      });
      toast(is_active ? "Yoqildi" : "Bloklandi");
      await loadBusinesses();
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Xatolik");
    }
  }

  function openCreateBiz() {
    setBizForm({ ...EMPTY_BIZ_FORM });
  }

  async function openEditBiz(b: Biz) {
    try {
      const detail = await apiFetch<{
        id: string;
        name: string;
        slug: string;
        category: string;
        description: string;
        address: string;
        phone: string;
        owner: { telegram_id: number | null; phone: string };
      }>(`/api/admin/businesses/${b.id}`);
      setBizForm({
        id: detail.id,
        name: detail.name,
        slug: detail.slug,
        category: detail.category,
        owner_telegram_id: String(detail.owner.telegram_id ?? ""),
        owner_first_name: "",
        owner_phone: detail.owner.phone || "",
        description: detail.description,
        address: detail.address,
        phone: detail.phone,
      });
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Yuklanmadi");
    }
  }

  async function saveBiz() {
    if (!bizForm) return;
    if (!bizForm.name.trim()) {
      toast("Nom kerak");
      return;
    }
    setBizSaving(true);
    try {
      if (bizForm.id) {
        await apiFetch(`/api/admin/businesses/${bizForm.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: bizForm.name,
            category: bizForm.category,
            description: bizForm.description,
            address: bizForm.address,
            phone: bizForm.phone,
          }),
        });
        toast("Saqlandi");
      } else {
        const tg = Number(bizForm.owner_telegram_id);
        if (!tg || tg <= 0) {
          toast("Egasining Telegram ID kerak");
          setBizSaving(false);
          return;
        }
        if (!/^[a-z0-9][a-z0-9-]*$/.test(bizForm.slug)) {
          toast("Slug: faqat a-z 0-9 va '-'");
          setBizSaving(false);
          return;
        }
        await apiFetch("/api/admin/businesses", {
          method: "POST",
          body: JSON.stringify({
            name: bizForm.name,
            slug: bizForm.slug,
            category: bizForm.category,
            owner_telegram_id: tg,
            owner_first_name: bizForm.owner_first_name || null,
            owner_phone: bizForm.owner_phone || null,
            description: bizForm.description || null,
            address: bizForm.address || null,
            phone: bizForm.phone || null,
          }),
        });
        toast("Yaratildi");
      }
      setBizForm(null);
      await loadBusinesses();
    } catch (e) {
      toast((e as Error).message?.slice(0, 120) || "Saqlash xatolik");
    } finally {
      setBizSaving(false);
    }
  }

  async function openSubForm(b: Biz) {
    try {
      const detail = await apiFetch<{
        subscription: {
          id: string;
          plan: string;
          status: string;
          expires_at: string | null;
        } | null;
      }>(`/api/admin/businesses/${b.id}`);
      if (!detail.subscription) {
        toast("Obuna yo‘q. Avval +7 yoki +30 kun bilan yarating");
        return;
      }
      setSubForm({
        business_id: b.id,
        business_name: b.name,
        subscription_id: detail.subscription.id,
        plan: detail.subscription.plan,
        status: detail.subscription.status,
        expires_at: (detail.subscription.expires_at || "").slice(0, 10),
      });
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Yuklanmadi");
    }
  }

  async function saveSub() {
    if (!subForm) return;
    setSubSaving(true);
    try {
      const expIso = subForm.expires_at
        ? new Date(`${subForm.expires_at}T23:59:59Z`).toISOString()
        : null;
      await apiFetch(`/api/admin/subscriptions/${subForm.subscription_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan: subForm.plan,
          status: subForm.status,
          expires_at: expIso,
        }),
      });
      toast("Obuna yangilandi");
      setSubForm(null);
      await loadBusinesses();
    } catch (e) {
      toast((e as Error).message?.slice(0, 120) || "Saqlash xatolik");
    } finally {
      setSubSaving(false);
    }
  }

  async function deleteBiz(b: Biz) {
    const isDeleted = !!b.deleted_at;
    if (isDeleted) {
      if (
        !window.confirm(
          `BUTUNLAY o‘chirish: "${b.name}".\n\n` +
            "Bu qaytarib bo‘lmaydi. Faqat aktiv bronlari yo‘q bo‘lsa o‘chiriladi."
        )
      )
        return;
      try {
        await apiFetch(`/api/admin/businesses/${b.id}?hard=true`, {
          method: "DELETE",
        });
        toast("O‘chirildi");
        await loadBusinesses();
      } catch (e) {
        toast((e as Error).message?.slice(0, 120) || "O‘chirishda xatolik");
      }
      return;
    }
    if (
      !window.confirm(
        `Arxivga ko‘chirish: "${b.name}". Biznes "BLOK" qilinadi va ro‘yxatdan yashiriladi.`
      )
    )
      return;
    try {
      await apiFetch(`/api/admin/businesses/${b.id}`, { method: "DELETE" });
      toast("Arxivlandi");
      await loadBusinesses();
    } catch (e) {
      toast((e as Error).message?.slice(0, 120) || "Xatolik");
    }
  }

  async function approve(txId: string) {
    try {
      await apiFetch("/api/payments/approve", {
        method: "POST",
        body: JSON.stringify({ transaction_id: txId }),
      });
      toast("Tasdiqlandi");
      await Promise.all([loadPending(), loadRecent()]);
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Tasdiqlash xatolik");
    }
  }

  async function refund(txId: string, businessName: string, amount: number) {
    if (
      !window.confirm(
        `Pulni qaytarish: ${businessName} (${fmtSum(amount)} so‘m).\n\n` +
          "Tranzaksiya REFUNDED bo‘ladi va biznesning faol obunasi BEKOR qilinadi.\n\n" +
          "Davom etasizmi?"
      )
    ) {
      return;
    }
    setRefundingId(txId);
    try {
      await apiFetch("/api/payments/refund", {
        method: "POST",
        body: JSON.stringify({ transaction_id: txId }),
      });
      toast("Pul qaytarildi, obuna bekor qilindi");
      await Promise.all([loadRecent(), loadBusinesses(), loadSummary()]);
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Qaytarishda xatolik");
    } finally {
      setRefundingId(null);
    }
  }

  async function reject(txId: string) {
    const reason = (rejectReason[txId] || "").trim();
    if (!reason) {
      toast("Rad etish sababini kiriting");
      return;
    }
    try {
      await apiFetch("/api/payments/reject", {
        method: "POST",
        body: JSON.stringify({ transaction_id: txId, reason }),
      });
      toast("Rad etildi");
      setRejectReason((prev) => {
        const next = { ...prev };
        delete next[txId];
        return next;
      });
      await loadPending();
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Rad etish xatolik");
    }
  }

  async function saveCard() {
    const digits = card.card_number.replace(/\D/g, "");
    if (digits.length < 12 || digits.length > 19) {
      toast("Karta raqami 12–19 raqam bo‘lishi kerak");
      return;
    }
    if (!card.card_holder.trim()) {
      toast("Karta egasi nomi kerak");
      return;
    }
    setSavingCard(true);
    try {
      const r = await apiFetch<CardInfo>("/api/payments/card/info", {
        method: "PUT",
        body: JSON.stringify(card),
      });
      setCard(r);
      toast("Karta saqlandi");
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Saqlashda xatolik");
    } finally {
      setSavingCard(false);
    }
  }

  async function savePrices() {
    const monthly = Number(prices.monthly.replace(/\D/g, "")) || 0;
    const yearly = Number(prices.yearly.replace(/\D/g, "")) || 0;
    setSavingPrices(true);
    try {
      const r = await apiFetch<PlanPrices>("/api/admin/plan-prices", {
        method: "PUT",
        body: JSON.stringify({ monthly_price: monthly, yearly_price: yearly }),
      });
      setPrices({
        monthly: r.monthly_override ? String(r.monthly_override) : "",
        yearly: r.yearly_override ? String(r.yearly_override) : "",
      });
      toast("Narxlar saqlandi");
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Saqlashda xatolik");
    } finally {
      setSavingPrices(false);
    }
  }

  async function exportBackup() {
    setBackupBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`${apiBase()}/api/admin/backup/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const m = disp.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || `yozuv-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Eksport tayyor");
    } catch (e) {
      toast((e as Error).message || "Eksport xatolik");
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup() {
    if (!importFile) {
      toast("Fayl tanlanmagan");
      return;
    }
    if (
      !window.confirm(
        "DIQQAT! Barcha ma‘lumotlar o‘chirilib, fayldan tiklanadi. Davom etasizmi?"
      )
    )
      return;
    setBackupBusy(true);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch(`${apiBase()}/api/admin/backup/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const r = (await res.json()) as { inserted_rows: number; tables: number };
      toast(`Import: ${r.inserted_rows} qator`);
      setImportFile(null);
      await loadSummary();
      await loadBusinesses();
    } catch (e) {
      toast((e as Error).message || "Import xatolik");
    } finally {
      setBackupBusy(false);
    }
  }

  async function sendBroadcast() {
    if (broadcastText.trim().length < 3) {
      toast("Kamida 3 ta belgi");
      return;
    }
    const filters: Record<string, string> = {};
    if (broadcastFilters.category) filters.category = broadcastFilters.category;
    if (broadcastFilters.plan) filters.plan = broadcastFilters.plan;
    if (broadcastFilters.subscription_status)
      filters.subscription_status = broadcastFilters.subscription_status;
    try {
      const r = await apiFetch<{ sent: number; failed: number; total: number }>(
        "/api/admin/broadcast",
        {
          method: "POST",
          body: JSON.stringify({
            text: broadcastText,
            only_active: true,
            filters: Object.keys(filters).length ? filters : null,
          }),
        }
      );
      toast(`Yuborildi: ${r.sent}/${r.total}`);
      setBroadcastText("");
      setBroadcastFilters(EMPTY_BROADCAST_FILTERS);
      await loadBroadcastHistory();
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    }
  }

  async function retryBroadcast(id: string) {
    setRetryingId(id);
    try {
      const r = await apiFetch<{ sent: number; failed: number; retried: number }>(
        `/api/admin/broadcasts/${id}/retry`,
        { method: "POST" }
      );
      toast(`Qayta yuborildi: ${r.sent}/${r.retried}`);
      await loadBroadcastHistory();
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Xatolik");
    } finally {
      setRetryingId(null);
    }
  }

  async function exportPayments() {
    setExportingPayments(true);
    try {
      const token = getToken();
      const res = await fetch(`${apiBase()}/api/admin/payments/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const m = disp.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || `yozuv-payments-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("CSV tayyor");
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Eksport xatolik");
    } finally {
      setExportingPayments(false);
    }
  }

  async function deleteReview(id: string) {
    if (!window.confirm("Sharhni butunlay o‘chirish?")) return;
    try {
      await apiFetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      toast("O‘chirildi");
      await loadReviews();
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "O‘chirishda xatolik");
    }
  }

  async function addAdmin() {
    const tg = Number(newAdminId.replace(/\D/g, ""));
    if (!tg || tg <= 0) {
      toast("Telegram ID kerak");
      return;
    }
    setAddingAdmin(true);
    try {
      await apiFetch("/api/admin/admins", {
        method: "POST",
        body: JSON.stringify({ telegram_id: tg, name: newAdminName || null }),
      });
      toast("Admin qo‘shildi");
      setNewAdminId("");
      setNewAdminName("");
      await loadAdmins();
    } catch (e) {
      toast((e as Error).message?.slice(0, 100) || "Xatolik");
    } finally {
      setAddingAdmin(false);
    }
  }

  async function removeAdmin(tg: number) {
    if (!window.confirm(`Adminni o‘chirish: ${tg}?`)) return;
    try {
      await apiFetch(`/api/admin/admins/${tg}`, { method: "DELETE" });
      toast("O‘chirildi");
      await loadAdmins();
    } catch (e) {
      toast((e as Error).message?.slice(0, 100) || "Xatolik");
    }
  }

  async function openActivity(b: Biz) {
    setActivity({ businessName: b.name, data: null });
    try {
      const data = await apiFetch<Activity>(`/api/admin/businesses/${b.id}/activity`);
      setActivity({ businessName: b.name, data });
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Yuklanmadi");
      setActivity(null);
    }
  }

  if (isAdmin === null) {
    return <YzLoader />;
  }
  if (!isAdmin) {
    return (
      <div>
        <ScreenHeader title="Admin" />
        <div className="card-soft mx-4 p-5 md:mx-0">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFE7E3] text-[#C93A2A]">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="mt-3 font-display text-lg font-bold text-ink-900">
            Kirish cheklangan
          </h3>
          <p className="mt-1 text-sm text-ink-500">
            Bu sahifa faqat admin uchun. <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">ADMIN_TELEGRAM_IDS</code>{" "}
            .env-ga qo‘shing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Admin paneli" subtitle="Platformani boshqaring" />

      <div className="mt-2 grid grid-cols-3 gap-2 px-4 md:grid-cols-6 md:px-0">
        {TABS.map(({ k, label, icon: Icon }) => {
          const active = tab === k;
          const badge =
            k === "payments" && pending.length > 0 ? pending.length : undefined;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 font-display text-[12px] font-bold transition-colors tap md:py-3.5 md:text-[13px]",
                active
                  ? "bg-ink-900 text-white shadow-[0_4px_12px_rgba(11,15,31,0.2)]"
                  : "bg-white text-ink-700 shadow-soft hover:bg-ink-50"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.6 : 2.2} />
              <span className="leading-tight">{label}</span>
              {badge !== undefined && (
                <span
                  className={cn(
                    "absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-extrabold",
                    active ? "bg-lemon text-ink-900" : "bg-coral text-white"
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3 px-4 md:px-0">
        {tab === "summary" && !card.card_number && (
          <button
            type="button"
            onClick={() => setTab("settings")}
            className="flex w-full items-start gap-3 rounded-3xl bg-[#FFE7E3] p-4 text-left tap"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#C93A2A] text-white">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-sm font-extrabold text-[#C93A2A]">
                Karta sozlanmagan
              </div>
              <div className="mt-0.5 text-xs text-[#C93A2A]/80">
                Mijozlar karta orqali to‘lay olmaydi. Bosing va kartani kiriting.
              </div>
            </div>
          </button>
        )}

        {tab === "summary" && sum && (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <StatCard label="Bizneslar" value={sum.businesses_total} sub={`Faol: ${sum.businesses_active}`} tone="indigo" icon={Building2} />
            <StatCard label="Yangi (7 kun)" value={sum.businesses_new_7d} tone="mint" icon={Sparkles} />
            <StatCard label="Faol obunalar" value={sum.active_subscriptions} sub={`Trial: ${sum.trial_subscriptions} · Pulli: ${sum.paid_subscriptions}`} tone="lemon" icon={Wallet} />
            <StatCard label="MRR" value={fmtShort(sum.mrr_uzs)} sub="so‘m / oy" tone="mint" icon={TrendingUp} />
            <StatCard label="Daromad (7 kun)" value={fmtShort(sum.revenue_7d_uzs)} sub="so‘m" tone="indigo" icon={CreditCard} />
            <StatCard label="Tasdiqlash kutmoqda" value={sum.pending_card_payments} sub="kutilmoqda" tone="coral" icon={Clock} />
          </div>
        )}

        {tab === "summary" && metrics && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <StatCard
                label="Konversiya"
                value={`${metrics.conversion_pct}%`}
                sub="trial → pulli"
                tone="mint"
                icon={TrendingUp}
              />
              <StatCard
                label="ARPU"
                value={fmtShort(metrics.arpu_uzs)}
                sub="so‘m / biznes"
                tone="indigo"
                icon={Wallet}
              />
              <StatCard
                label="Ottok (30 kun)"
                value={metrics.churned_subscriptions}
                sub="bekor / tugagan"
                tone="coral"
                icon={TrendingDown}
              />
              <StatCard
                label="Tugaydi (7 kun)"
                value={metrics.expiring_7d}
                sub="obuna"
                tone="lemon"
                icon={Clock}
              />
            </div>

            <MiniBarChart
              title="Yangi bizneslar"
              subtitle={`Oxirgi ${metrics.days} kun`}
              series={metrics.growth}
            />
            <MiniBarChart
              title="Daromad"
              subtitle={`Oxirgi ${metrics.days} kun · so‘m`}
              series={metrics.revenue}
              money
            />
          </div>
        )}

        {tab === "summary" && expiring.length > 0 && (
          <div>
            <div className="eyebrow mb-2 px-1">Tez orada tugaydi</div>
            <div className="card-soft divide-y divide-ink-100 overflow-hidden p-0">
              {expiring.map((e) => (
                <div
                  key={e.business_id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-extrabold text-ink-900">
                      {e.business_name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-500">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-extrabold uppercase tracking-wide text-indigo-700">
                        {e.plan}
                      </span>
                      <span className="font-mono">{e.expires_at.slice(0, 10)}</span>
                      {e.owner.telegram_id != null && (
                        <span className="font-mono text-ink-400">· {e.owner.telegram_id}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                      e.days_left <= 2
                        ? "bg-[#FFE7E3] text-[#C93A2A]"
                        : "bg-[#FFF3DA] text-[#A8751A]"
                    )}
                  >
                    {e.days_left} kun
                  </span>
                  <button
                    onClick={() => extend(e.business_id, 30)}
                    className="shrink-0 rounded-2xl bg-indigo-50 px-3 py-2 text-[12px] font-bold text-indigo-700 tap hover:bg-indigo-100"
                  >
                    +30 kun
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "businesses" && (
          <div className="space-y-3">
            <div className="card-soft flex flex-wrap items-center gap-2 p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setBizSearch(bizQuery);
                }}
                className="relative min-w-[180px] flex-1"
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  value={bizQuery}
                  onChange={(e) => setBizQuery(e.target.value)}
                  placeholder="Nom, slug yoki Telegram ID"
                  className="yz-input py-2 pl-9 text-sm"
                />
              </form>
              <select
                value={bizCategory}
                onChange={(e) => setBizCategory(e.target.value)}
                className="yz-input w-auto py-2 text-sm"
              >
                <option value="">Barcha kategoriya</option>
                {BIZ_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={bizSub}
                onChange={(e) => setBizSub(e.target.value)}
                className="yz-input w-auto py-2 text-sm"
              >
                <option value="">Barcha obuna</option>
                <option value="active">Faol obuna</option>
                <option value="trial">Trial</option>
                <option value="paid">Pulli</option>
                <option value="none">Obunasiz</option>
              </select>
              {(bizSearch || bizCategory || bizSub) && (
                <button
                  onClick={() => {
                    setBizQuery("");
                    setBizSearch("");
                    setBizCategory("");
                    setBizSub("");
                  }}
                  className="rounded-2xl bg-ink-100 px-3 py-2 text-[13px] font-bold text-ink-600 tap hover:bg-ink-200"
                >
                  Tozalash
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink-600">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300"
                />
                O‘chirilganlarni ko‘rsatish
              </label>
              <button
                onClick={openCreateBiz}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm"
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} />
                Yangi biznes
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
            {biz.length === 0 && (
              <div className="card-soft flex flex-col items-center gap-3 p-8 text-center md:col-span-2">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Building2 className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <span className="text-sm font-medium text-ink-400">Bizneslar yo‘q</span>
              </div>
            )}
            {biz.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "card-soft p-5",
                  b.deleted_at && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-display text-base font-extrabold text-ink-900">
                        {b.name}
                      </div>
                      {b.deleted_at ? (
                        <span className="shrink-0 rounded-full bg-ink-200 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-ink-700">
                          ARXIV
                        </span>
                      ) : (
                        !b.is_active && (
                          <span className="shrink-0 rounded-full bg-[#FFE7E3] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#C93A2A]">
                            BLOK
                          </span>
                        )
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                      <span className="truncate font-mono">{b.slug}</span>
                      <span className="text-ink-300">·</span>
                      <span>{b.category}</span>
                    </div>
                    <div className="mt-2 truncate text-xs text-ink-500">
                      👤 {b.owner.name || "—"}
                      {b.owner.telegram_id != null && (
                        <span className="ml-1 font-mono text-ink-400">
                          · {b.owner.telegram_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {b.subscription ? (
                      <div className="rounded-2xl bg-indigo-50 px-3 py-2">
                        <div className="font-display text-[11px] font-extrabold uppercase tracking-wide text-indigo-700">
                          {b.subscription.plan || "—"}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-indigo-600/70">
                          {b.subscription.expires_at?.slice(0, 10) || "—"}
                        </div>
                      </div>
                    ) : (
                      <span className="rounded-full bg-[#FFE7E3] px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-[#C93A2A]">
                        OBUNA YO‘Q
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!b.deleted_at && (
                    <>
                      <button
                        onClick={() => extend(b.id, 7)}
                        className="rounded-2xl bg-indigo-50 px-3.5 py-2 text-[13px] font-bold text-indigo-700 tap hover:bg-indigo-100"
                      >
                        +7 kun
                      </button>
                      <button
                        onClick={() => extend(b.id, 30)}
                        className="rounded-2xl bg-indigo-50 px-3.5 py-2 text-[13px] font-bold text-indigo-700 tap hover:bg-indigo-100"
                      >
                        +30 kun
                      </button>
                      <button
                        onClick={() => openSubForm(b)}
                        className="rounded-2xl bg-indigo-50 px-3 py-2 text-[13px] font-bold text-indigo-700 tap hover:bg-indigo-100"
                        title="Reja/holat"
                      >
                        Reja
                      </button>
                      <button
                        onClick={() => openActivity(b)}
                        className="inline-flex items-center gap-1 rounded-2xl bg-ink-100 px-3 py-2 text-[13px] font-bold text-ink-700 tap hover:bg-ink-200"
                        title="Faollik"
                      >
                        <ActivityIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                      </button>
                      <button
                        onClick={() => openEditBiz(b)}
                        className="inline-flex items-center gap-1 rounded-2xl bg-ink-100 px-3 py-2 text-[13px] font-bold text-ink-700 tap hover:bg-ink-200"
                        title="Tahrirlash"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2.6} />
                      </button>
                      <button
                        onClick={() => toggleBiz(b.id, !b.is_active)}
                        className={cn(
                          "ml-auto rounded-2xl px-3.5 py-2 text-[13px] font-bold tap",
                          b.is_active
                            ? "bg-[#FFE7E3] text-[#C93A2A] hover:bg-[#FCD7CE]"
                            : "bg-[#E6FAF3] text-[#0E9577] hover:bg-[#CFF1E1]"
                        )}
                      >
                        {b.is_active ? "Bloklash" : "Yoqish"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteBiz(b)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-[13px] font-bold tap",
                      b.deleted_at
                        ? "ml-auto bg-[#FFE7E3] text-[#C93A2A] hover:bg-[#FCD7CE]"
                        : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                    )}
                    title={b.deleted_at ? "Butunlay o‘chirish" : "Arxivga"}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.6} />
                    {b.deleted_at && <span>O‘chirish</span>}
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {tab === "payments" && (
          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                onClick={exportPayments}
                disabled={exportingPayments}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-ink-100 px-4 py-2 text-sm font-bold text-ink-700 tap hover:bg-ink-200 disabled:opacity-50"
              >
                <Download className="h-4 w-4" strokeWidth={2.6} />
                {exportingPayments ? "..." : "CSV eksport"}
              </button>
            </div>
            <div>
              <div className="eyebrow mb-2 px-1">Tasdiqlash kutmoqda</div>
              <div className="grid gap-3 md:grid-cols-2">
            {pending.length === 0 && (
              <div className="card-soft flex flex-col items-center gap-3 p-8 text-center md:col-span-2">
                <div className="grid h-12 w-12 place-items-center rounded-2xl text-[#0E9577]" style={{ background: "#E7F8F2" }}>
                  <Check className="h-6 w-6" strokeWidth={2.4} />
                </div>
                <span className="text-sm font-medium text-ink-400">Hozircha kutilayotgan to‘lov yo‘q</span>
              </div>
            )}
            {pending.map((p) => (
              <div key={p.transaction_id} className="card-soft p-5">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-extrabold text-ink-900">
                      {p.business_name}
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="tnum font-display text-xl font-extrabold tracking-[-0.02em] text-ink-900">
                        {fmtSum(p.amount)}
                      </span>
                      <span className="text-xs font-semibold text-ink-500">so‘m</span>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-indigo-700">
                        {p.plan}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-ink-400">
                      {p.created_at.replace("T", " ").slice(0, 16)}
                    </div>
                  </div>
                  {imageUrls[p.transaction_id] && (
                    <a
                      href={imageUrls[p.transaction_id]}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0"
                      title="Chekni kattalashtirish"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrls[p.transaction_id]}
                        alt="chek"
                        className="h-24 w-24 rounded-2xl object-cover ring-1 ring-ink-100 transition-transform hover:scale-105"
                      />
                    </a>
                  )}
                </div>

                {p.user_comment && (
                  <div className="mt-3 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-700">
                    💬 {p.user_comment}
                  </div>
                )}

                <div className="mt-4 space-y-2.5">
                  <button
                    onClick={() => approve(p.transaction_id)}
                    className="btn-primary w-full justify-center py-2.5 text-sm"
                  >
                    <Check className="mr-1.5 h-4 w-4" strokeWidth={2.6} />
                    Tasdiqlash
                  </button>
                  <div className="flex gap-2">
                    <input
                      value={rejectReason[p.transaction_id] || ""}
                      onChange={(e) =>
                        setRejectReason({
                          ...rejectReason,
                          [p.transaction_id]: e.target.value,
                        })
                      }
                      placeholder="Rad etish sababi (majburiy)"
                      className="yz-input flex-1 py-2.5 text-xs"
                    />
                    <button
                      onClick={() => reject(p.transaction_id)}
                      className="shrink-0 rounded-2xl bg-[#FFE7E3] px-4 py-2.5 text-sm font-bold text-[#C93A2A] tap hover:bg-[#FCD7CE]"
                      aria-label="Rad etish"
                    >
                      <X className="h-4 w-4" strokeWidth={2.6} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
              </div>
            </div>

            <div>
              <div className="eyebrow mb-2 px-1">Oxirgi to‘lovlar</div>
              <div className="card-soft divide-y divide-ink-100 overflow-hidden p-0">
                {recent.length === 0 && (
                  <div className="p-6 text-center text-sm text-ink-400">
                    Hali to‘lov yo‘q
                  </div>
                )}
                {recent.map((tx) => {
                  const status = (tx.status || "").toUpperCase();
                  const isCompleted = status.includes("COMPLETED");
                  const isRefunded = status.includes("REFUNDED");
                  const isRejected = status.includes("REJECTED");
                  const statusStyle = isCompleted
                    ? "bg-[#E6FAF3] text-[#0E9577]"
                    : isRefunded
                      ? "bg-ink-100 text-ink-600"
                      : isRejected
                        ? "bg-[#FFE7E3] text-[#C93A2A]"
                        : "bg-[#FFF3DA] text-[#A8751A]";
                  return (
                    <div
                      key={tx.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-sm font-extrabold text-ink-900">
                          {tx.business_name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-500">
                          <span className="font-mono">
                            {tx.created_at.replace("T", " ").slice(0, 16)}
                          </span>
                          <span className="text-ink-300">·</span>
                          <span>{tx.provider}</span>
                          <span className="text-ink-300">·</span>
                          <span>{tx.plan}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tnum font-display text-sm font-extrabold tracking-[-0.01em] text-ink-900">
                          {fmtSum(tx.amount)}
                        </div>
                        <span
                          className={cn(
                            "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                            statusStyle
                          )}
                        >
                          {status.replace(/^.*\./, "")}
                        </span>
                      </div>
                      {isCompleted && (
                        <button
                          onClick={() =>
                            refund(tx.id, tx.business_name, tx.amount)
                          }
                          disabled={refundingId === tx.id}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-2xl bg-[#FFE7E3] px-3 py-2 text-[12px] font-bold text-[#C93A2A] tap hover:bg-[#FCD7CE] disabled:opacity-50"
                          title="Pulni qaytarish va obunani bekor qilish"
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.6} />
                          {refundingId === tx.id ? "..." : "Qaytarish"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "reviews" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={reviewsMaxRating}
                onChange={(e) => setReviewsMaxRating(e.target.value)}
                className="yz-input w-auto py-2 text-sm"
              >
                <option value="">Barcha bahollar</option>
                <option value="1">Faqat 1★</option>
                <option value="2">2★ va past</option>
                <option value="3">3★ va past</option>
              </select>
              <button
                onClick={loadReviews}
                className="rounded-2xl bg-ink-100 px-3 py-2 text-sm font-bold text-ink-700 tap hover:bg-ink-200"
              >
                Yangilash
              </button>
              <span className="ml-auto text-[11px] font-semibold text-ink-400">
                <span className="tnum">{reviews.length}</span> sharh
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {reviews.length === 0 && (
                <div className="card-soft flex flex-col items-center gap-3 p-8 text-center md:col-span-2">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF3DA] text-[#A8751A]">
                    <Star className="h-6 w-6" strokeWidth={2.2} />
                  </div>
                  <span className="text-sm font-medium text-ink-400">Sharhlar yo‘q</span>
                </div>
              )}
              {reviews.map((r) => (
                <div key={r.id} className="card-soft p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-extrabold text-ink-900">
                        {r.business_name}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-display text-sm font-extrabold text-[#A8751A]">
                          {"★".repeat(r.rating)}
                          <span className="text-ink-300">
                            {"★".repeat(Math.max(0, 5 - r.rating))}
                          </span>
                        </span>
                        <span className="font-mono text-[11px] text-ink-400">
                          {r.created_at.replace("T", " ").slice(0, 16)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteReview(r.id)}
                      className="shrink-0 grid h-8 w-8 place-items-center rounded-2xl bg-[#FFE7E3] text-[#C93A2A] tap hover:bg-[#FCD7CE]"
                      title="O‘chirish"
                      aria-label="O‘chirish"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2.6} />
                    </button>
                  </div>
                  {r.comment && (
                    <div className="mt-3 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-700">
                      {r.comment}
                    </div>
                  )}
                  {r.owner_reply && (
                    <div className="mt-2 rounded-2xl bg-indigo-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-indigo-700">
                      ↪ {r.owner_reply}
                    </div>
                  )}
                  {r.client_name && (
                    <div className="mt-2 text-[11px] text-ink-400">👤 {r.client_name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "system" && (
          <div className="space-y-4">
            {!platformStats ? (
              <YzLoader />
            ) : (
              <>
                <div>
                  <div className="eyebrow mb-2 px-1">Tavsiya (referral)</div>
                  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                    <StatCard
                      label="Takliflar"
                      value={platformStats.referrals_total}
                      tone="indigo"
                      icon={Gift}
                    />
                    <StatCard
                      label="Yakunlangan"
                      value={platformStats.referrals_completed}
                      tone="mint"
                      icon={Check}
                    />
                    <StatCard
                      label="Konversiya"
                      value={`${platformStats.referral_conversion_pct}%`}
                      tone="lemon"
                      icon={TrendingUp}
                    />
                  </div>
                </div>

                <div>
                  <div className="eyebrow mb-2 px-1">Promo-kodlar</div>
                  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                    <StatCard
                      label="Jami"
                      value={platformStats.promo_total}
                      sub={`Faol: ${platformStats.promo_active}`}
                      tone="indigo"
                      icon={Sparkles}
                    />
                    <StatCard
                      label="Ishlatilgan"
                      value={platformStats.promo_uses}
                      tone="mint"
                      icon={Check}
                    />
                    <StatCard
                      label="Navbat (waitlist)"
                      value={platformStats.waitlist_waiting}
                      sub={`Jami: ${platformStats.waitlist_total}`}
                      tone="coral"
                      icon={Clock}
                    />
                  </div>
                </div>

                <div>
                  <div className="eyebrow mb-2 px-1">Umumiy</div>
                  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                    <StatCard
                      label="Bronlar"
                      value={platformStats.bookings_total}
                      tone="indigo"
                      icon={ActivityIcon}
                    />
                    <StatCard
                      label="Mijozlar"
                      value={platformStats.clients_total}
                      tone="mint"
                      icon={Users}
                    />
                    <StatCard
                      label="Sharhlar"
                      value={platformStats.reviews_total}
                      sub={
                        platformStats.reviews_avg != null
                          ? `O‘rtacha: ${platformStats.reviews_avg}★`
                          : undefined
                      }
                      tone="lemon"
                      icon={Star}
                    />
                  </div>
                </div>

                <div className="card-soft p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#E6FAF3] text-[#0E9577]">
                      <Database className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-extrabold text-ink-900">
                        Oxirgi avto-nusxa
                      </h3>
                      {platformStats.last_backup ? (
                        <div className="mt-1 text-xs text-ink-500">
                          <span className="font-mono">{platformStats.last_backup.name}</span>
                          <span className="mx-1 text-ink-300">·</span>
                          {platformStats.last_backup.size_kb} KB
                          <span className="mx-1 text-ink-300">·</span>
                          {platformStats.last_backup.modified_at
                            .replace("T", " ")
                            .slice(0, 16)}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-ink-400">
                          Avto-nusxa yo‘q (import qilinmagan)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="card-soft p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-extrabold text-ink-900">
                        Adminlar
                      </h3>
                      <p className="mt-1 text-xs text-ink-500">
                        ENV adminlarni o‘chirib bo‘lmaydi. Yangilarini bu yerda qo‘shing.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 divide-y divide-ink-100">
                    {admins.map((a) => (
                      <div
                        key={a.telegram_id}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-ink-900">
                            {a.name || (
                              <span className="font-mono">{a.telegram_id}</span>
                            )}
                          </div>
                          {a.name && (
                            <div className="font-mono text-[11px] text-ink-400">
                              {a.telegram_id}
                            </div>
                          )}
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                            a.source === "env"
                              ? "bg-[#FFF3DA] text-[#A8751A]"
                              : "bg-indigo-50 text-indigo-700"
                          )}
                        >
                          {a.source === "env" ? "Superadmin" : "Admin"}
                        </span>
                        {a.removable ? (
                          <button
                            onClick={() => removeAdmin(a.telegram_id)}
                            className="grid h-8 w-8 place-items-center rounded-2xl bg-[#FFE7E3] text-[#C93A2A] tap hover:bg-[#FCD7CE]"
                            aria-label="O‘chirish"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2.6} />
                          </button>
                        ) : (
                          <span className="grid h-8 w-8 place-items-center text-ink-300">
                            <Shield className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={newAdminId}
                      onChange={(e) =>
                        setNewAdminId(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="Telegram ID"
                      className="yz-input w-36 py-2 font-mono text-sm"
                    />
                    <input
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder="Ism (ixtiyoriy)"
                      className="yz-input min-w-[120px] flex-1 py-2 text-sm"
                    />
                    <button
                      onClick={addAdmin}
                      disabled={addingAdmin}
                      className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.6} />
                      Qo‘shish
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "broadcast" && (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="card-soft p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF3DA] text-[#A8751A]">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink-900">
                    Egalariga xabar
                  </h3>
                  <p className="mt-1 text-xs text-ink-500">
                    Faol bizneslarning Telegram egalariga yuboriladi. Filtrlar bilan torajting.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    Kategoriya
                  </label>
                  <select
                    value={broadcastFilters.category}
                    onChange={(e) =>
                      setBroadcastFilters({
                        ...broadcastFilters,
                        category: e.target.value,
                      })
                    }
                    className="yz-input mt-1 py-2 text-sm"
                  >
                    <option value="">Hammasi</option>
                    {BIZ_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    Reja
                  </label>
                  <select
                    value={broadcastFilters.plan}
                    onChange={(e) =>
                      setBroadcastFilters({
                        ...broadcastFilters,
                        plan: e.target.value,
                      })
                    }
                    className="yz-input mt-1 py-2 text-sm"
                  >
                    <option value="">Hammasi</option>
                    {SUB_PLANS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    Obuna holati
                  </label>
                  <select
                    value={broadcastFilters.subscription_status}
                    onChange={(e) =>
                      setBroadcastFilters({
                        ...broadcastFilters,
                        subscription_status: e.target.value,
                      })
                    }
                    className="yz-input mt-1 py-2 text-sm"
                  >
                    <option value="">Hammasi</option>
                    {SUB_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea
                rows={8}
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Yangilik matni..."
                className="yz-input mt-4"
              />
              <div className="tnum mt-2 text-right text-[11px] font-semibold text-ink-400">
                {broadcastText.length} / 4000
              </div>
              <button
                onClick={sendBroadcast}
                className="btn-primary mt-3 w-full justify-center"
              >
                <Megaphone className="mr-2 h-4 w-4" />
                Yuborish
              </button>
            </div>

            <div>
              <div className="eyebrow mb-2 px-1">Tarix</div>
              <div className="card-soft divide-y divide-ink-100 overflow-hidden p-0">
                {broadcastHistory.length === 0 && (
                  <div className="p-6 text-center text-sm text-ink-400">
                    Hali rassılka yo‘q
                  </div>
                )}
                {broadcastHistory.map((h) => (
                  <div key={h.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-[11px] text-ink-400">
                        {h.created_at.replace("T", " ").slice(0, 16)}
                      </span>
                      <span className="rounded-full bg-[#E6FAF3] px-2 py-0.5 text-[10px] font-extrabold text-[#0E9577]">
                        ✓ {h.sent_count}
                      </span>
                      {h.failed_count > 0 && (
                        <span className="rounded-full bg-[#FFE7E3] px-2 py-0.5 text-[10px] font-extrabold text-[#C93A2A]">
                          ✕ {h.failed_count}
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-ink-500">
                        {h.sent_by_name || h.sent_by_telegram_id}
                      </span>
                    </div>
                    <div className="mt-2 line-clamp-3 whitespace-pre-wrap text-[13px] text-ink-700">
                      {h.text}
                    </div>
                    {Object.keys(h.filters).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.entries(h.filters)
                          .filter(([, v]) => v !== null && v !== "" && v !== false)
                          .map(([k, v]) => (
                            <span
                              key={k}
                              className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[10px] text-ink-700"
                            >
                              {k}={String(v)}
                            </span>
                          ))}
                      </div>
                    )}
                    {h.failed_count > 0 && (
                      <button
                        onClick={() => retryBroadcast(h.id)}
                        disabled={retryingId === h.id}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-2xl bg-ink-100 px-3 py-1.5 text-[12px] font-bold text-ink-700 tap hover:bg-ink-200 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.6} />
                        {retryingId === h.id
                          ? "..."
                          : `Tushib qolganlarga (${h.failed_count})`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">
            <div className="card-soft space-y-3 p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink-900">
                    To‘lov uchun karta
                  </h3>
                  <p className="mt-1 text-xs text-ink-500">
                    Mijozlar shu kartaga to‘laydi.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">
                  Karta raqami
                </label>
                <input
                  value={card.card_number}
                  onChange={(e) => setCard({ ...card, card_number: e.target.value })}
                  placeholder="8600 1234 5678 9012"
                  className="yz-input mt-1 font-mono tracking-wider"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">Egasi</label>
                <input
                  value={card.card_holder}
                  onChange={(e) => setCard({ ...card, card_holder: e.target.value })}
                  placeholder="ALIYEV ALI"
                  className="yz-input mt-1 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">
                  Mijozga ko‘rsatiladigan izoh
                </label>
                <textarea
                  value={card.payment_comment}
                  onChange={(e) => setCard({ ...card, payment_comment: e.target.value })}
                  rows={3}
                  placeholder="To‘lash uchun kartaga o‘tkazma qiling..."
                  className="yz-input mt-1"
                />
              </div>
              <button
                onClick={saveCard}
                disabled={savingCard}
                className="btn-primary w-full justify-center"
              >
                {savingCard ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>

            {/* Live preview of how the card looks to clients */}
            <div className="space-y-2">
              <div className="eyebrow">Mijoz ko‘radi</div>
              <div
                className="relative overflow-hidden rounded-3xl p-5 text-white shadow-soft-lg"
                style={{ background: "linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)" }}
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-indigo-500/30 blur-2xl" />
                <div className="relative">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-white/60">
                    Karta raqami
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold tracking-[0.12em]">
                    {card.card_number || "•••• •••• •••• ••••"}
                  </div>
                  <div className="mt-5 text-[11px] font-bold uppercase tracking-wide text-white/60">
                    Egasi
                  </div>
                  <div className="mt-1 font-display text-base font-extrabold uppercase tracking-wide">
                    {card.card_holder || "EGAGA NOMI"}
                  </div>
                </div>
              </div>
              {card.payment_comment && (
                <div className="card-soft p-4 text-[13px] leading-relaxed text-ink-700">
                  💬 {card.payment_comment}
                </div>
              )}
            </div>

            <div className="card-soft space-y-3 p-5 md:col-span-2 md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF3DA] text-[#A8751A]">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink-900">
                    Obuna narxlari
                  </h3>
                  <p className="mt-1 text-xs text-ink-500">
                    Bo‘sh qoldirilsa — standart narx ishlatiladi.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink-500">
                    Oylik (so‘m)
                  </label>
                  <input
                    inputMode="numeric"
                    value={prices.monthly}
                    onChange={(e) =>
                      setPrices({ ...prices, monthly: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder="187500"
                    className="yz-input mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-500">
                    Yillik (so‘m)
                  </label>
                  <input
                    inputMode="numeric"
                    value={prices.yearly}
                    onChange={(e) =>
                      setPrices({ ...prices, yearly: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder="1875000"
                    className="yz-input mt-1 font-mono"
                  />
                </div>
              </div>
              <button
                onClick={savePrices}
                disabled={savingPrices}
                className="btn-primary w-full justify-center"
              >
                {savingPrices ? "Saqlanmoqda…" : "Narxlarni saqlash"}
              </button>
            </div>
          </div>
        )}

        {tab === "backup" && (
          <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">
            <div className="card-soft p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#E6FAF3] text-[#0E9577]">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink-900">
                    Eksport
                  </h3>
                  <p className="mt-1 text-xs text-ink-500">
                    Barcha ma‘lumotlar JSON fayl sifatida yuklab olinadi.
                  </p>
                </div>
              </div>
              <button
                onClick={exportBackup}
                disabled={backupBusy}
                className="btn-primary mt-4 w-full justify-center"
              >
                {backupBusy ? "Tayyorlanmoqda…" : "Eksport (JSON)"}
              </button>
            </div>

            <div className="card-soft border-2 border-[#FFE7E3] p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFE7E3] text-[#C93A2A]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink-900">
                    Import
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[#C93A2A]">
                    DIQQAT! Joriy ma‘lumotlar butunlay o‘chiriladi.
                  </p>
                </div>
              </div>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 px-4 py-6 text-center transition-colors hover:border-ink-300">
                <Database className="h-6 w-6 text-ink-400" />
                <span className="text-sm font-bold text-ink-700">
                  {importFile ? importFile.name : "Faylni tanlang"}
                </span>
                {!importFile && (
                  <span className="text-[11px] text-ink-400">JSON, max 50 MB</span>
                )}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <button
                onClick={importBackup}
                disabled={backupBusy || !importFile}
                className="btn-soft mt-3 w-full justify-center disabled:opacity-50"
              >
                {backupBusy ? "Yuklanmoqda…" : "Import qilish"}
              </button>
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="yz-input w-auto py-2 text-sm"
              >
                <option value="">Hammasi</option>
                <option value="business.create">business.create</option>
                <option value="business.update">business.update</option>
                <option value="business.toggle">business.toggle</option>
                <option value="business.soft_delete">business.soft_delete</option>
                <option value="business.hard_delete">business.hard_delete</option>
                <option value="subscription.extend">subscription.extend</option>
                <option value="subscription.patch">subscription.patch</option>
                <option value="payment.approve">payment.approve</option>
                <option value="payment.reject">payment.reject</option>
                <option value="payment.refund">payment.refund</option>
                <option value="review.delete">review.delete</option>
                <option value="settings.prices">settings.prices</option>
                <option value="admin.add">admin.add</option>
                <option value="admin.remove">admin.remove</option>
                <option value="broadcast.send">broadcast.send</option>
                <option value="backup.import">backup.import</option>
              </select>
              <button
                onClick={loadAudit}
                className="rounded-2xl bg-ink-100 px-3 py-2 text-sm font-bold text-ink-700 tap hover:bg-ink-200"
              >
                Yangilash
              </button>
              <span className="ml-auto text-[11px] font-semibold text-ink-400">
                <span className="tnum">{audit.length}</span> yozuv
              </span>
            </div>
            <div className="card-soft divide-y divide-ink-100 overflow-hidden p-0">
              {audit.length === 0 && (
                <div className="p-6 text-center text-sm text-ink-400">
                  Hech qanday harakat qayd etilmagan
                </div>
              )}
              {audit.map((e) => (
                <div key={e.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-indigo-700">
                      {e.action}
                    </span>
                    {e.target_type && (
                      <span className="text-[11px] text-ink-500">
                        {e.target_type}
                        {e.target_id && (
                          <span className="ml-1 font-mono text-ink-400">
                            {e.target_id.slice(0, 8)}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[11px] text-ink-400">
                      {e.created_at.replace("T", " ").slice(0, 19)}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-700">
                    👤 {e.admin_name || "—"}{" "}
                    <span className="font-mono text-ink-400">
                      ({e.admin_telegram_id})
                    </span>
                  </div>
                  {e.payload && Object.keys(e.payload).length > 0 && (
                    <pre className="mt-1.5 overflow-x-auto rounded-lg bg-ink-50 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-ink-700">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {bizForm && (
        <BusinessFormModal
          form={bizForm}
          onChange={setBizForm}
          onClose={() => setBizForm(null)}
          onSave={saveBiz}
          saving={bizSaving}
        />
      )}
      {subForm && (
        <SubscriptionFormModal
          form={subForm}
          onChange={setSubForm}
          onClose={() => setSubForm(null)}
          onSave={saveSub}
          saving={subSaving}
        />
      )}
      {activity && (
        <ActivityModal state={activity} onClose={() => setActivity(null)} />
      )}
    </div>
  );
}

function ActivityModal({
  state,
  onClose,
}: {
  state: ActivityModalState;
  onClose: () => void;
}) {
  const d = state.data;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="card-lg w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <div className="font-display text-lg font-extrabold text-ink-900">
              Faollik
            </div>
            <div className="mt-0.5 truncate text-xs text-ink-500">
              {state.businessName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-2xl text-ink-500 hover:bg-ink-100"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
        {!d ? (
          <div className="p-10">
            <YzLoader />
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard
                label="Bronlar"
                value={d.bookings_total}
                sub={`30 kun: ${d.bookings_30d}`}
                tone="indigo"
                icon={ActivityIcon}
              />
              <StatCard
                label="Mijozlar"
                value={d.clients_total}
                tone="mint"
                icon={Users}
              />
              <StatCard
                label="Daromad"
                value={fmtShort(d.revenue_total_uzs)}
                sub="so‘m"
                tone="lemon"
                icon={Wallet}
              />
              <StatCard
                label="Reyting"
                value={d.reviews_avg != null ? `${d.reviews_avg}★` : "—"}
                sub={`${d.reviews_count} sharh`}
                tone="coral"
                icon={Star}
              />
            </div>
            {Object.keys(d.bookings_by_status).length > 0 && (
              <div>
                <div className="eyebrow mb-2">Bronlar holati</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(d.bookings_by_status).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-bold text-ink-700"
                    >
                      {k}: <span className="tnum">{v}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionFormModal({
  form,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  form: SubFormState;
  onChange: (next: SubFormState) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = (patch: Partial<SubFormState>) => onChange({ ...form, ...patch });
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="card-lg w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <div className="font-display text-lg font-extrabold text-ink-900">
              Obunani boshqarish
            </div>
            <div className="mt-0.5 truncate text-xs text-ink-500">{form.business_name}</div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-2xl text-ink-500 hover:bg-ink-100"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="block text-xs font-semibold text-ink-500">Reja</label>
            <select
              value={form.plan}
              onChange={(e) => set({ plan: e.target.value })}
              className="yz-input mt-1"
            >
              {SUB_PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-500">Holat</label>
            <select
              value={form.status}
              onChange={(e) => set({ status: e.target.value })}
              className="yz-input mt-1"
            >
              {SUB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-500">
              Tugash sanasi
            </label>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => set({ expires_at: e.target.value })}
              className="yz-input mt-1"
            />
          </div>
          <div className="rounded-2xl bg-ink-50 px-3 py-2 text-[11px] text-ink-500">
            Egaga Telegram orqali xabar yuboriladi.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-soft px-4 py-2 text-sm"
          >
            Bekor
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary px-4 py-2 text-sm"
          >
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BusinessFormModal({
  form,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  form: BizFormState;
  onChange: (next: BizFormState) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const isEdit = !!form.id;
  const set = (patch: Partial<BizFormState>) => onChange({ ...form, ...patch });
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="card-lg w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="font-display text-lg font-extrabold text-ink-900">
            {isEdit ? "Biznesni tahrirlash" : "Yangi biznes"}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-2xl text-ink-500 hover:bg-ink-100"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className="block text-xs font-semibold text-ink-500">Nom *</label>
            <input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              className="yz-input mt-1"
              placeholder="Salon nomi"
            />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-ink-500">
                Slug * (faqat a-z 0-9 va &lsquo;-&rsquo;)
              </label>
              <input
                value={form.slug}
                onChange={(e) => set({ slug: e.target.value.toLowerCase() })}
                className="yz-input mt-1 font-mono"
                placeholder="my-salon"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-ink-500">Kategoriya</label>
            <select
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
              className="yz-input mt-1"
            >
              {BIZ_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {!isEdit && (
            <>
              <div>
                <label className="block text-xs font-semibold text-ink-500">
                  Ega Telegram ID *
                </label>
                <input
                  value={form.owner_telegram_id}
                  onChange={(e) =>
                    set({ owner_telegram_id: e.target.value.replace(/\D/g, "") })
                  }
                  className="yz-input mt-1 font-mono"
                  placeholder="123456789"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink-500">
                    Egasi ismi
                  </label>
                  <input
                    value={form.owner_first_name}
                    onChange={(e) => set({ owner_first_name: e.target.value })}
                    className="yz-input mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-500">
                    Egasi tel.
                  </label>
                  <input
                    value={form.owner_phone}
                    onChange={(e) => set({ owner_phone: e.target.value })}
                    className="yz-input mt-1"
                  />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-ink-500">Telefon</label>
            <input
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              className="yz-input mt-1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-500">Manzil</label>
            <input
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              className="yz-input mt-1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-500">Tavsif</label>
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={3}
              className="yz-input mt-1"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-soft px-4 py-2 text-sm"
          >
            Bekor
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary px-4 py-2 text-sm"
          >
            {saving ? "Saqlanmoqda…" : isEdit ? "Saqlash" : "Yaratish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({
  title,
  subtitle,
  series,
  money,
}: {
  title: string;
  subtitle: string;
  series: { day: string; value: number }[];
  money?: boolean;
}) {
  const bars = series.map((s) => ({ day: s.day.slice(5), value: s.value }));
  const maxBar = Math.max(1, ...series.map((s) => s.value));
  const total = series.reduce((a, s) => a + s.value, 0);
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 text-white shadow-soft-lg"
      style={{ background: "linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)" }}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-indigo-500/30 blur-2xl" />
      <div className="relative flex items-baseline justify-between">
        <div>
          <div className="font-display text-base font-extrabold">{title}</div>
          <div className="text-[11px] font-semibold text-white/60">{subtitle}</div>
        </div>
        <div className="tnum font-display text-lg font-extrabold tracking-tight">
          {money ? fmtSum(total) : total}
        </div>
      </div>
      <div className="relative mt-3 h-40">
        <RevenueChart bars={bars} maxBar={maxBar} highlightIdx={bars.length - 1} />
      </div>
    </div>
  );
}

const STAT_TONES = {
  indigo: { bg: "#EEF0FF", fg: "#4853F5", chip: "rgba(255,255,255,0.7)" },
  mint: { bg: "#E7F8F2", fg: "#0E9577", chip: "rgba(255,255,255,0.7)" },
  lemon: { bg: "#FFF3DA", fg: "#A8751A", chip: "rgba(255,255,255,0.7)" },
  coral: { bg: "#FFE7E3", fg: "#C93A2A", chip: "rgba(255,255,255,0.7)" },
} as const;

function StatCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone: keyof typeof STAT_TONES;
  icon: typeof Shield;
}) {
  const t = STAT_TONES[tone];
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-4 md:p-5"
      style={{ background: t.bg }}
    >
      <div
        className="grid h-10 w-10 place-items-center rounded-2xl"
        style={{ background: t.chip, color: t.fg }}
      >
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div
        className="mt-3 tnum font-display text-[26px] font-extrabold leading-none tracking-tighter md:text-[30px]"
        style={{ color: t.fg }}
      >
        {value}
      </div>
      <div
        className="mt-2 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: t.fg, opacity: 0.7 }}
      >
        {label}
      </div>
      {sub && (
        <div
          className="mt-1 text-[11px] font-semibold"
          style={{ color: t.fg, opacity: 0.6 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
