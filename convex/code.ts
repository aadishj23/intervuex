import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getCodeStateByCallId = query({
  args: { streamCallId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("codeStates")
      .withIndex("by_stream_call_id", (q) => q.eq("streamCallId", args.streamCallId))
      .first();
    return doc || null;
  },
});

export const upsertCodeState = mutation({
  args: {
    streamCallId: v.string(),
    language: v.string(),
    questionId: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("codeStates")
      .withIndex("by_stream_call_id", (q) => q.eq("streamCallId", args.streamCallId))
      .first();

    const payload = {
      ...args,
      updatedBy: identity.subject,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("codeStates", payload);
  },
});


