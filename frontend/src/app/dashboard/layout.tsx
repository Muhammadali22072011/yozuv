import { AuthBootstrap } from "@/components/dashboard/AuthBootstrap";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthBootstrap>
      <DashboardShell>{children}</DashboardShell>
    </AuthBootstrap>
  );
}
