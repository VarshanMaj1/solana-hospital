"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsAdmin } from "@/hooks/use-rbac-admin";

const RESTRICTED = ["/patients", "/staff"];

export function RbacRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = useIsAdmin();

  React.useEffect(() => {
    if (isAdmin) {
      return;
    }
    const blocked = RESTRICTED.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (blocked) {
      router.replace("/");
    }
  }, [isAdmin, pathname, router]);

  return null;
}

