export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export interface BookingRow {
  id: string;
  business_id: string;
  service_id: string | null;
  client_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  cancel_reason: string | null;
  payment_status: string;
  payment_amount: number;
  notes: string;
  created_at: string;
}

export interface BusinessMe {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  logo_url: string;
  welcome_text: string;
  after_booking_text: string;
  reminder_text: string;
  confirmation_mode: string;
  language: string;
  is_active: boolean;
  created_at: string;
}
