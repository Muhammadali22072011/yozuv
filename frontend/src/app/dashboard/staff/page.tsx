"use client";

import { useEffect, useState } from "react";
import { Plus, Power, Trash2, UserCircle2 } from "lucide-react";
import { ScreenHeader, TourFloat, YzLoader, useToast } from "@/components/yz";
import type { TourStep } from "@/components/yz";
import { apiFetch } from "@/lib/api";
import { usePageTour } from "@/lib/use-page-tour";

const STAFF_TOUR: TourStep[] = [
  {
    targetSelector: "[data-tour='staff-add']",
    title: "Mutaxassis qo'shing",
    body:
      "Salonda bir nechta usta bor bo'lsa — har birini alohida qo'shing. Mijozlar botda yozilayotganda kerakli ustani tanlaydi.",
    mode: "action",
  },
];

type Staff = {
  id: string;
  name: string;
  phone: string;
  photo_url: string;
  is_active: boolean;
  order: number;
  service_ids: string[];
};

type ServiceLite = { id: string; name: string };

export default function StaffPage() {
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const tour = usePageTour("staff_v1", STAFF_TOUR);

  async function load() {
    const [s, svc] = await Promise.all([
      apiFetch<Staff[]>("/api/business/me/staff"),
      apiFetch<ServiceLite[]>("/api/business/me/services").catch(() => []),
    ]);
    setStaff(s);
    setServices(svc);
  }

  useEffect(() => {
    load().catch(() => setStaff([]));
  }, []);

  async function toggle(s: Staff) {
    setBusy(true);
    try {
      await apiFetch<Staff>(`/api/business/me/staff/${s.id}/toggle`, {
        method: "PATCH",
      });
      await load();
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Staff) {
    if (!confirm(`${s.name} - haqiqatan o'chirilsinmi?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/business/me/staff/${s.id}`, { method: "DELETE" });
      await load();
      toast("O'chirildi");
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  if (!staff) return <YzLoader fullscreen />;

  return (
    <div>
      <ScreenHeader
        title="Mutaxassislar"
        back="/dashboard/settings"
        right={
          <button
            data-tour="staff-add"
            onClick={() => setCreating(true)}
            className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Qo&apos;shish
          </button>
        }
      />

      <div className="mt-2 px-4 md:px-0">
        {staff.length === 0 ? (
          <div className="card-soft p-8 text-center">
            <UserCircle2 className="mx-auto h-10 w-10 text-ink-300" />
            <div className="mt-3 font-display text-base font-bold text-ink-700">
              Hali mutaxassis qo&apos;shilmagan
            </div>
            <div className="mt-1 text-xs text-ink-400">
              Salondagi har bir usta o&apos;z jadvalini boshqarsin — har bir
              yozilishda mijoz aniq ustani tanlaydi.
            </div>
            <button
              onClick={() => setCreating(true)}
              className="btn-primary mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm"
            >
              <Plus className="h-4 w-4" /> Birinchi mutaxassisni qo&apos;shing
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {staff.map((s) => (
              <div
                key={s.id}
                className={`card-soft flex items-center gap-3 p-3.5 ${s.is_active ? "" : "opacity-60"}`}
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ink-100 text-ink-400">
                  {s.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.photo_url}
                      alt={s.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="h-7 w-7" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => setEditing(s)}
                    className="block w-full text-left"
                  >
                    <div className="truncate font-display text-sm font-bold text-ink-900">
                      {s.name}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-ink-400">
                      {s.phone || "—"} ·{" "}
                      {s.service_ids.length
                        ? `${s.service_ids.length} ta xizmat`
                        : "Xizmatlar yo'q"}
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => toggle(s)}
                  disabled={busy}
                  title={s.is_active ? "Yashirish" : "Faollashtirish"}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-500 hover:bg-ink-200"
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(s)}
                  disabled={busy}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFE7E3] text-coral hover:bg-[#FFD3CC]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(editing || creating) && (
        <StaffSheet
          initial={editing}
          services={services}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={async () => {
            setEditing(null);
            setCreating(false);
            await load();
          }}
        />
      )}

      <TourFloat tour={tour} />
    </div>
  );
}

function StaffSheet({
  initial,
  services,
  onClose,
  onSaved,
}: {
  initial: Staff | null;
  services: ServiceLite[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url || "");
  const [pickedServices, setPickedServices] = useState<Set<string>>(
    new Set(initial?.service_ids || []),
  );
  const [saving, setSaving] = useState(false);

  function toggleService(id: string) {
    setPickedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!name.trim()) {
      toast("Ism kiriting");
      return;
    }
    setSaving(true);
    try {
      let id = initial?.id;
      if (id) {
        // Update
        await apiFetch<Staff>(`/api/business/me/staff/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            photo_url: photoUrl.trim(),
          }),
        });
      } else {
        // Create
        const created = await apiFetch<Staff>("/api/business/me/staff", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            photo_url: photoUrl.trim(),
          }),
        });
        id = created.id;
      }

      // Sync service assignment in a second call so create-then-assign
      // is one user action even though it's two HTTP requests.
      await apiFetch(`/api/business/me/staff/${id}/services`, {
        method: "PUT",
        body: JSON.stringify({ service_ids: Array.from(pickedServices) }),
      });
      toast("Saqlandi");
      await onSaved();
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display text-lg font-extrabold text-ink-900">
          {initial ? "Mutaxassisni tahrirlash" : "Yangi mutaxassis"}
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="text-xs font-semibold text-ink-500">Ism</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="yz-input mt-1"
              placeholder="Aziz Sobirov"
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-ink-500">Telefon</div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="yz-input mt-1"
              placeholder="+998 90 123 45 67"
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-ink-500">Foto URL (ixtiyoriy)</div>
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="yz-input mt-1"
              placeholder="https://…"
            />
          </label>

          {services.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-ink-500">
                Xizmatlar ({pickedServices.size})
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {services.map((s) => {
                  const on = pickedServices.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        on
                          ? "bg-indigo-600 text-white"
                          : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-ink-100 px-4 py-3 text-sm font-bold text-ink-700"
          >
            Bekor qilish
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary flex-1 px-4 py-3 text-sm disabled:opacity-50"
          >
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
