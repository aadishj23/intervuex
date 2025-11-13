"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import LoaderUI from "./LoaderUI";
import { getCandidateInfo, groupInterviews } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarIcon, CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react";
import { format } from "date-fns";
import CommentDialog from "@/components/CommentDialog";
import Link from "next/link";
import toast from "react-hot-toast";

type Interview = Doc<"interviews">;

export default function InterviewerInterviews() {
  const users = useQuery(api.users.getUsers);
  const interviews = useQuery(api.interviews.getAllInterviews);
  const updateStatus = useMutation(api.interviews.updateInterviewStatus);

  const handleStatusUpdate = async (interviewId: Id<"interviews">, status: string) => {
    try {
      await updateStatus({ id: interviewId, status });
      toast.success(`Interview marked as ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (!interviews || !users) return <LoaderUI />;

  const groupedInterviews = groupInterviews(interviews);

  return (
    <div className="space-y-8">
      {Object.entries(groupedInterviews).map(([categoryId, list]: any) => (
        list?.length > 0 && (
          <section key={categoryId}>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-semibold capitalize">{categoryId} Interviews</h2>
              <Badge variant={categoryId === "upcoming" ? "outline" : categoryId === "completed" ? "secondary" : categoryId === "succeeded" ? "default" : "destructive"}>
                {list.length}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((interview: Interview) => {
                const candidateInfo = getCandidateInfo(users, interview.candidateId);
                const startTime = new Date(interview.startTime);
                return (
                  <Card className="hover:shadow-md transition-all" key={interview._id}>
                    <CardHeader className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={candidateInfo.image} />
                          <AvatarFallback>{candidateInfo.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">{candidateInfo.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{interview.title}</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {format(startTime, "MMM dd")}
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {format(startTime, "hh:mm a")}
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 pt-0 flex flex-col gap-3">
                      {interview.status === "upcoming" && (
                        <div className="flex gap-2 w-full">
                          <Link href={`/meeting/${interview.streamCallId}`} className="flex-1">
                            <Button className="w-full">Start now</Button>
                          </Link>
                          <Button
                            variant="outline"
                            className="w-full sm:flex-1"
                            onClick={() => {
                              const url = `${window.location.origin}/meeting/${interview.streamCallId}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Meeting link copied");
                            }}
                          >
                            Copy link
                          </Button>
                          <Button
                            variant="secondary"
                            className="w-full sm:w-auto"
                            onClick={() => handleStatusUpdate(interview._id, "completed")}
                          >
                            Mark completed
                          </Button>
                        </div>
                      )}

                      {interview.status === "completed" && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                          <Button className="w-full sm:flex-1" onClick={() => handleStatusUpdate(interview._id, "succeeded")}>
                            <CheckCircle2Icon className="h-4 w-4 mr-2" />
                            Pass
                          </Button>
                          <Button
                            variant="destructive"
                            className="w-full sm:flex-1"
                            onClick={() => handleStatusUpdate(interview._id, "failed")}
                          >
                            <XCircleIcon className="h-4 w-4 mr-2" />
                            Fail
                          </Button>
                        </div>
                      )}
                      <CommentDialog interviewId={interview._id} />
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </section>
        )
      ))}
    </div>
  );
}


