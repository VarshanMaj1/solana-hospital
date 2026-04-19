"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * Sonner toasts aligned with app theme (light/dark) and design tokens.
 */
export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      expand
      richColors
      closeButton
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            "group border border-border bg-card text-card-foreground shadow-lg backdrop-blur-sm",
          title: "font-semibold text-card-foreground",
          description: "text-muted-foreground",
          actionButton:
            "rounded-md bg-primary font-medium text-primary-foreground hover:bg-primary/90",
          cancelButton: "rounded-md border border-border bg-background",
          closeButton:
            "border-0 bg-muted/60 text-foreground hover:bg-muted hover:text-foreground",
        },
      }}
    />
  );
}
