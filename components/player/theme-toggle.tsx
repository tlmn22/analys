"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function PlayerThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0"
      aria-label="Гэрэлтэй / бараан горим солих"
      title="Гэрэлтэй / бараан горим солих"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon aria-hidden="true" className="size-4 dark:hidden" />
      <SunIcon aria-hidden="true" className="hidden size-4 dark:block" />
    </Button>
  );
}
