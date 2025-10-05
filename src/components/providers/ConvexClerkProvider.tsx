"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
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
      } catch {}
    };
    run();
  }, [isSignedIn, user, syncUser]);

  return <>{children}</>;
}
