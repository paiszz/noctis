"use client";

import { useSyncExternalStore } from "react";
import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);

  return () => {
    observer.disconnect();
    mediaQuery.removeEventListener("change", callback);
  };
}

function getSnapshot(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

export function Toaster({
  position = "bottom-right",
  richColors = true,
  theme: explicitTheme,
  style,
  ...props
}: ToasterProps) {
  const activeTheme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const theme = explicitTheme ?? activeTheme;

  return (
    <SonnerToaster
      position={position}
      richColors={richColors}
      theme={theme}
      style={{
        fontFamily: "var(--font-urbanist), sans-serif",
        ...style,
      }}
      {...props}
    />
  );
}
