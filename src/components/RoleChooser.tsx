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

    const hasPrompted = typeof window !== "undefined" && localStorage.getItem("rolePrompted");
    if (!currentUser?.role && !hasPrompted) {
      setOpen(true);
    }
  }, [isSignedIn, user, currentUser]);

  const handleSave = async () => {
    if (!user) return;
    try {
      await updateRole({ clerkId: user.id, role });
      if (typeof window !== "undefined") localStorage.setItem("rolePrompted", "1");
      setOpen(false);
      toast.success("Role saved");
    } catch (e) {
      toast.error("Failed to set role");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Select your role</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="candidate">Candidate</SelectItem>
                <SelectItem value="interviewer">Interviewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RoleChooser;


