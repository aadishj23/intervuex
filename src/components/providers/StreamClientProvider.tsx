"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import { StreamVideoClient, StreamVideo } from "@stream-io/video-react-sdk";
import { useUser } from "@clerk/nextjs";
import LoaderUI from "../LoaderUI";
import { streamTokenProvider } from "@/actions/stream.actions";

const StreamVideoProvider = ({ children }: { children: ReactNode }) => {
  const [streamVideoClient, setStreamVideoClient] = useState<StreamVideoClient>();
  const { user, isLoaded } = useUser();
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    
    // Only initialize if user ID changed (prevents re-initialization on re-renders)
    if (userIdRef.current === user.id && streamVideoClient) {
      return;
    }

    // Use getOrCreateInstance to prevent duplicate client instances
    // This ensures the same client is reused across re-renders
    const client = StreamVideoClient.getOrCreateInstance({
      apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY!,
      user: {
        id: user.id,
        name: user.firstName || "" + " " + user.lastName || "" || user.id,
        image: user.imageUrl,
      },
      tokenProvider: streamTokenProvider,
    });

    setStreamVideoClient(client);
    userIdRef.current = user.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isLoaded]);

  if (!streamVideoClient) return <LoaderUI />;

  return <StreamVideo client={streamVideoClient}>{children}</StreamVideo>;
};

export default StreamVideoProvider;
