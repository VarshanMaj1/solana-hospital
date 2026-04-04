import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Pill,
  Users,
  UserSquare2,
} from "lucide-react";

export const dashboardNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/staff", label: "Staff", icon: UserSquare2 },
  { href: "/records", label: "Records", icon: FileText },
  { href: "/medicines", label: "Medicines", icon: Pill },
  { href: "/payments", label: "Payments", icon: CreditCard },
] as const;
