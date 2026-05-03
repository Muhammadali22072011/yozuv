"use client";

import { Phone, MessageSquare, Plus } from "lucide-react";
import { Avatar } from "./Avatar";
import { SheetBody, SheetContent, SheetHeader, SheetRoot } from "./Sheet";
import { useToast } from "./Toast";
import { callPhone, fmtSum, messageTelegram } from "./utils";

export type ClientDetail = {
  id: string;
  telegram_id?: number | null;
  first_name: string;
  last_name: string;
  phone?: string;
  visits?: number;
  total_spent?: number;
  last_visit?: string | null;
  favorite_service?: string | null;
  is_vip?: boolean;
};

function ActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-indigo-50 px-3 py-3 tap"
    >
      <span className="text-indigo-600">{icon}</span>
      <span className="font-display text-xs font-bold text-indigo-600">{label}</span>
    </button>
  );
}

export function ClientSheet({
  open,
  onOpenChange,
  client,
  onNewBooking,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: ClientDetail | null;
  onNewBooking?: (client: ClientDetail) => void;
}) {
  const toast = useToast();
  if (!client) return null;
  const name = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Mijoz";
  const spent = client.total_spent ?? 0;

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent height="tall">
        <SheetHeader />
        <SheetBody>
          <div className="text-center">
            <div className="inline-flex">
              <Avatar name={name} size={72} vip={client.is_vip} />
            </div>
            <div className="mt-3 font-display text-[22px] font-extrabold tracking-tight text-ink-900">
              {name}
            </div>
            <div className="mt-0.5 text-sm text-ink-500">{client.phone || "—"}</div>
          </div>

          <div className="mt-5 flex gap-2.5">
            <ActionBtn
              icon={<Phone className="h-5 w-5" />}
              label="Qo'ng'iroq"
              onClick={() => callPhone(client.phone)}
            />
            <ActionBtn
              icon={<MessageSquare className="h-5 w-5" />}
              label="Xabar"
              onClick={() => {
                if (client.phone) {
                  messageTelegram(client.phone);
                } else {
                  toast("Mijozning telefoni saqlanmagan");
                }
              }}
            />
            <ActionBtn
              icon={<Plus className="h-5 w-5" />}
              label="Yozilish"
              onClick={() => {
                if (onNewBooking) {
                  onNewBooking(client);
                  onOpenChange(false);
                } else {
                  toast("Yangi yozilish");
                }
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <div className="card-soft p-3.5 text-center">
              <div className="font-display text-xl font-extrabold text-indigo-600">
                {client.visits ?? 0}
              </div>
              <div className="text-[11px] font-semibold text-ink-500">Tashrif</div>
            </div>
            <div className="card-soft p-3.5 text-center">
              <div className="font-display text-xl font-extrabold text-mint">
                {spent >= 1000 ? `${fmtSum(Math.round(spent / 1000))}k` : fmtSum(spent)}
              </div>
              <div className="text-[11px] font-semibold text-ink-500">Jami so‘m</div>
            </div>
            <div className="card-soft p-3.5 text-center">
              <div className="mt-0.5 truncate font-display text-sm font-extrabold text-ink-900">
                {client.favorite_service || "—"}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-ink-500">Sevimli</div>
            </div>
          </div>
        </SheetBody>
      </SheetContent>
    </SheetRoot>
  );
}
