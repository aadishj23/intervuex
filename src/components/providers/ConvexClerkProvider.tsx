"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check initial theme
    const checkTheme = () => {
      const html = document.documentElement;
      const isDarkMode = html.classList.contains("dark");
      setIsDark(isDarkMode);
    };

    // Check on mount
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Also listen to system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      // Only update if theme is set to "system"
      const html = document.documentElement;
      if (!html.classList.contains("dark") && !html.classList.contains("light")) {
        checkTheme();
      }
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  return (
    <ClerkProvider 
      key={mounted ? (isDark ? "dark" : "light") : "light"}
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={
        isDark 
          ? ({ baseTheme: "dark" } as any)
          : ({ baseTheme: "light" } as any)
      }
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <UserSync>
          {children}
        </UserSync>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export default ConvexClerkProvider;

function UserSync({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn } = useUser();
  const syncUser = useMutation(api.users.syncUser);

  useEffect(() => {
    const run = async () => {
      if (!isSignedIn || !user) return;
      try {
        await syncUser({
          name: user.fullName || user.username || user.id,
          email: user.primaryEmailAddress?.emailAddress || "",
          clerkId: user.id,
          image: user.imageUrl,
        });
      } catch (error) {
        console.error("Error syncing user:", error);
      }
    };
    run();
  }, [isSignedIn, user, syncUser]);

  return <>{children}</>;
}
