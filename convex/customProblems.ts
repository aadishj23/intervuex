import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createCustomProblem = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    examples: v.array(
      v.object({
        input: v.string(),
        output: v.string(),
        explanation: v.optional(v.string()),
      })
    ),
    constraints: v.optional(v.array(v.string())),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const problemId = await ctx.db.insert("customProblems", {
      title: args.title,
      description: args.description,
      examples: args.examples,
      constraints: args.constraints,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
    return problemId;
  },
});

export const getMyCustomProblems = query({
  args: { createdBy: v.string() },
  handler: async (ctx, args) => {
    const problems = await ctx.db
      .query("customProblems")
      .withIndex("by_creator", (q) => q.eq("createdBy", args.createdBy))
      .order("desc")
      .collect();
    return problems;
  },
});

export const getAllCustomProblems = query({
  handler: async (ctx) => {
    const problems = await ctx.db
      .query("customProblems")
      .order("desc")
      .collect();
    return problems;
  },
});

export const deleteCustomProblem = mutation({
  args: { problemId: v.id("customProblems") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.problemId);
  },
});

