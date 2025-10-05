"use client";

import { useUser } from "@clerk/nextjs";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import toast from "react-hot-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TimePicker from "@/components/TimePicker";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserInfo from "@/components/UserInfo";
import { Loader2Icon, XIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export default function ScheduleInterviewDialog({ open, onOpenChange }: Props) {
  const client = useStreamVideoClient();
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);

  const users = useQuery(api.users.getUsers) ?? [];
  const createInterview = useMutation(api.interviews.createInterview);

  const candidates = users?.filter((u) => u.role === "candidate");
  const interviewers = users?.filter((u) => u.role === "interviewer");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: new Date(),
    startTime: "09:00",
    endTime: "09:30",
    candidateId: "",
    interviewerIds: user?.id ? [user.id] : [],
  });

  const addInterviewer = (interviewerId: string) => {
    if (!formData.interviewerIds.includes(interviewerId)) {
      setFormData((prev) => ({ ...prev, interviewerIds: [...prev.interviewerIds, interviewerId] }));
    }
  };
  const removeInterviewer = (interviewerId: string) => {
    if (interviewerId === user?.id) return;
    setFormData((prev) => ({ ...prev, interviewerIds: prev.interviewerIds.filter((id) => id !== interviewerId) }));
  };

  const selectedInterviewers = interviewers.filter((i) => formData.interviewerIds.includes(i.clerkId));
  const availableInterviewers = interviewers.filter((i) => !formData.interviewerIds.includes(i.clerkId));

  const scheduleMeeting = async () => {
    if (!client || !user) return;
    if (!formData.candidateId || formData.interviewerIds.length === 0) {
      toast.error("Please select both candidate and at least one interviewer");
      return;
    }
    setIsCreating(true);
    try {
      const { title, description, date, startTime, endTime, candidateId, interviewerIds } = formData;
      const [sh, sm] = startTime.split(":");
      const [eh, em] = endTime.split(":");
      const start = new Date(date);
      start.setHours(parseInt(sh), parseInt(sm), 0);
      const end = new Date(date);
      end.setHours(parseInt(eh), parseInt(em), 0);
      if (end <= start) {
        toast.error("End time must be after start time");
        setIsCreating(false);
        return;
      }
      const id = crypto.randomUUID();
      const call = client.call("default", id);
      await call.getOrCreate({
        data: {
          starts_at: start.toISOString(),
          custom: { description: title, additionalDetails: description },
        },
      });
      await createInterview({
        title,
        description,
        startTime: start.getTime(),
        endTime: end.getTime(),
        status: "upcoming",
        streamCallId: id,
        candidateId,
        interviewerIds,
      });
      toast.success("Meeting scheduled successfully!");
      onOpenChange(false);
      setFormData({
        title: "",
        description: "",
        date: new Date(),
        startTime: "09:00",
        endTime: "09:30",
        candidateId: "",
        interviewerIds: user?.id ? [user.id] : [],
      });
    } catch (e) {
      toast.error("Failed to schedule meeting. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[calc(100vh-200px)] overflow-auto">
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input placeholder="Interview title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea placeholder="Interview description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Candidate</label>
            <Select value={formData.candidateId} onValueChange={(candidateId) => setFormData({ ...formData, candidateId })}>
              <SelectTrigger>
                <SelectValue placeholder="Select candidate" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.clerkId} value={candidate.clerkId}>
                    <UserInfo user={candidate} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Interviewers</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedInterviewers.map((interviewer) => (
                <div key={interviewer.clerkId} className="inline-flex items-center gap-2 bg-secondary px-2 py-1 rounded-md text-sm">
                  <UserInfo user={interviewer} />
                  {interviewer.clerkId !== user?.id && (
                    <button onClick={() => removeInterviewer(interviewer.clerkId)} className="hover:text-destructive transition-colors">
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {availableInterviewers.length > 0 && (
              <Select onValueChange={addInterviewer}>
                <SelectTrigger>
                  <SelectValue placeholder="Add interviewer" />
                </SelectTrigger>
                <SelectContent>
                  {availableInterviewers.map((interviewer) => (
                    <SelectItem key={interviewer.clerkId} value={interviewer.clerkId}>
                      <UserInfo user={interviewer} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <div className="w-full flex justify-center">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => date && setFormData({ ...formData, date })}
                  disabled={(date) => date < new Date()}
                  className="mx-auto"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <TimePicker label="Start time" value={formData.startTime} onChange={(v) => setFormData({ ...formData, startTime: v })} stepMinutes={5} />
              <TimePicker label="End time" value={formData.endTime} onChange={(v) => setFormData({ ...formData, endTime: v })} stepMinutes={5} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={scheduleMeeting} disabled={isCreating}>
              {isCreating ? (<><Loader2Icon className="mr-2 size-4 animate-spin" />Scheduling...</>) : ("Schedule Interview")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


