"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { PlusIcon, TrashIcon } from "lucide-react";
import toast from "react-hot-toast";

interface CreateProblemDialogProps {
  onProblemCreated?: () => void;
}

export default function CreateProblemDialog({ onProblemCreated }: CreateProblemDialogProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const createProblem = useMutation(api.customProblems.createCustomProblem);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [examples, setExamples] = useState<
    Array<{ input: string; output: string; explanation?: string }>
  >([{ input: "", output: "", explanation: "" }]);
  const [constraints, setConstraints] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addExample = () => {
    setExamples([...examples, { input: "", output: "", explanation: "" }]);
  };

  const removeExample = (index: number) => {
    setExamples(examples.filter((_, i) => i !== index));
  };

  const updateExample = (index: number, field: string, value: string) => {
    const updated = [...examples];
    updated[index] = { ...updated[index], [field]: value };
    setExamples(updated);
  };

  const addConstraint = () => {
    setConstraints([...constraints, ""]);
  };

  const removeConstraint = (index: number) => {
    setConstraints(constraints.filter((_, i) => i !== index));
  };

  const updateConstraint = (index: number, value: string) => {
    const updated = [...constraints];
    updated[index] = value;
    setConstraints(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    if (examples.length === 0 || !examples[0].input.trim() || !examples[0].output.trim()) {
      toast.error("At least one example with input and output is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createProblem({
        title: title.trim(),
        description: description.trim(),
        examples: examples.filter((ex) => ex.input.trim() && ex.output.trim()),
        constraints: constraints.filter((c) => c.trim()).length > 0 
          ? constraints.filter((c) => c.trim()) 
          : undefined,
        createdBy: user.id,
      });

      toast.success("Problem created successfully!");
      
      // Reset form
      setTitle("");
      setDescription("");
      setExamples([{ input: "", output: "", explanation: "" }]);
      setConstraints([""]);
      setOpen(false);
      
      if (onProblemCreated) {
        onProblemCreated();
      }
    } catch (error) {
      toast.error("Failed to create problem");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Custom Problem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Problem</DialogTitle>
          <DialogDescription>
            Create a custom coding problem for your interviews
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Problem Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Two Sum"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Problem Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the problem in detail..."
              className="min-h-[120px]"
              required
            />
          </div>

          {/* Examples */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Examples *</Label>
              <Button type="button" onClick={addExample} size="sm" variant="outline">
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Example
              </Button>
            </div>
            {examples.map((example, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Example {index + 1}</span>
                  {examples.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeExample(index)}
                      size="sm"
                      variant="ghost"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    value={example.input}
                    onChange={(e) => updateExample(index, "input", e.target.value)}
                    placeholder="Input (e.g., nums = [2,7,11,15], target = 9)"
                    required
                  />
                  <Input
                    value={example.output}
                    onChange={(e) => updateExample(index, "output", e.target.value)}
                    placeholder="Output (e.g., [0,1])"
                    required
                  />
                  <Input
                    value={example.explanation || ""}
                    onChange={(e) => updateExample(index, "explanation", e.target.value)}
                    placeholder="Explanation (optional)"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Constraints */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Constraints (Optional)</Label>
              <Button type="button" onClick={addConstraint} size="sm" variant="outline">
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Constraint
              </Button>
            </div>
            {constraints.map((constraint, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={constraint}
                  onChange={(e) => updateConstraint(index, e.target.value)}
                  placeholder="e.g., 1 ≤ nums.length ≤ 10^4"
                />
                <Button
                  type="button"
                  onClick={() => removeConstraint(index)}
                  size="sm"
                  variant="ghost"
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Problem"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

