"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import toast from "react-hot-toast";

function RoleChooser() {
  const { user, isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"candidate" | "interviewer">("candidate");

  const currentUser = useQuery(api.users.getUserByClerkId, {
    clerkId: user?.id || "",
  });
  const updateRole = useMutation(api.users.updateUserRole);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    if (currentUser === undefined) return; // wait for data

    // Show dialog if user doesn't have a role
    if (!currentUser?.role) {
      setOpen(true);
    }
  }, [isSignedIn, user, currentUser]);

  const handleSave = async () => {
    if (!user) return;
    try {
      await updateRole({ clerkId: user.id, role });
      setOpen(false);
      toast.success(`Welcome! You're registered as a ${role}`);
      // Reload to ensure all UI updates with the new role
      window.location.reload();
    } catch (e) {
      toast.error("Failed to set role");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[460px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welcome to IntervueX! 👋</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Please select your role to get started.
          </p>
          <div className="space-y-2">
            <Label>I am a...</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="candidate">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Candidate</span>
                  </div>
                </SelectItem>
                <SelectItem value="interviewer">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Interviewer</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} className="w-full sm:w-auto">Continue</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RoleChooser;


