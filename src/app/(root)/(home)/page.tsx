"use client";

import ActionCard from "@/components/ActionCard";
import { QUICK_ACTIONS } from "@/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import MeetingModal from "@/components/MeetingModal";
import { Button } from "@/components/ui/button";
import ScheduleInterviewDialog from "@/components/ScheduleInterviewDialog";
import InterviewerInterviews from "@/components/InterviewerInterviews";
import LoaderUI from "@/components/LoaderUI";
import { Loader2Icon } from "lucide-react";
import MeetingCard from "@/components/MeetingCard";
import { useUser } from "@clerk/nextjs";

export default function Home() {
  const router = useRouter();
  const { user } = useUser();

  const { isInterviewer, isCandidate, isLoading } = useUserRole();
  const interviews = useQuery(api.interviews.getMyInterviews);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"start" | "join">();
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [fadeWelcome, setFadeWelcome] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const key = `welcomeShown:${user.id}`;
    const already = typeof window !== "undefined" ? sessionStorage.getItem(key) : "1";
    if (already) return; // show once per session after sign-in

    setShowWelcome(true);
    try { sessionStorage.setItem(key, "1"); } catch {}

    const t1 = setTimeout(() => setFadeWelcome(true), 4500);
    const t2 = setTimeout(() => setShowWelcome(false), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [user?.id]);

  const handleQuickAction = (title: string) => {
    switch (title) {
      case "New Call":
        setModalType("start");
        setShowModal(true);
        break;
      case "Join Interview":
        setModalType("join");
        setShowModal(true);
        break;
      default:
        router.push(`/${title.toLowerCase()}`);
    }
  };

  if (isLoading) return <LoaderUI />;

  return (
    <div className="container max-w-7xl mx-auto p-6">
      {/* WELCOME SECTION */}
      {showWelcome && (
        <div
          className={`rounded-lg bg-card p-6 border shadow-sm mb-10 text-center transition-all duration-700 ${
            fadeWelcome ? "opacity-0 -translate-y-2 scale-[0.98]" : "opacity-100 translate-y-0"
          }`}
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            {`Welcome back${user?.firstName ? ", " + user.firstName + "!" : "!"}`}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isInterviewer
              ? "Manage your interviews and review candidates effectively"
              : "Access your upcoming interviews and preparations"}
          </p>
        </div>
      )}

      {/* Quick actions (shared) */}
        <>
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {QUICK_ACTIONS.filter((a) => a.title !== "Schedule").map((action) => (
              <ActionCard
                key={action.title}
                action={action}
                onClick={() => handleQuickAction(action.title)}
              />
            ))}
          </div>

          <MeetingModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title={modalType === "join" ? "Join Meeting" : "Start Meeting"}
            isJoinMeeting={modalType === "join"}
          />
        </>
      {/* ) : ( */}
        {isInterviewer ? (
          <div className="pt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">Interviews</h2>
              <Button onClick={() => setShowScheduleDialog(true)}>Schedule Interview</Button>
            </div>
            <ScheduleInterviewDialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog} />
            <InterviewerInterviews />
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold pt-8">Your Interviews</h1>
              <p className="text-muted-foreground mt-1">View and join your scheduled interviews</p>
            </div>

          <div className="mt-8">
            {interviews === undefined ? (
              <div className="flex justify-center py-12">
                <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : interviews.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {interviews.map((interview) => (
                  <MeetingCard key={interview._id} interview={interview} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                You have no scheduled interviews at the moment
              </div>
            )}
          </div>
          </>
        )}
      {/* )} */}
    </div>
  );
}
