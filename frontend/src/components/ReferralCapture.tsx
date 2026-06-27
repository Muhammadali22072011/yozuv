"use client";

import { useEffect } from "react";
import { captureReferral } from "@/lib/referral";

/**
 * App-wide referral capture. Mounted once in the root layout so a startapp /
 * ?ref= code is stashed the moment the invitee enters — landing (/), login,
 * register, anywhere — not only when they reach /auth/login. Renders nothing.
 */
export function ReferralCapture() {
  useEffect(() => {
    captureReferral();
  }, []);
  return null;
}
