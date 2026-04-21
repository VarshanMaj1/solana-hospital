"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type Props = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"   // 👈 fixed theme
      enableSystem={false}   // 👈 disable system
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}