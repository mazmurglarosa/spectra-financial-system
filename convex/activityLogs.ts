import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listLogs = query({
  handler: async (ctx) => {
    return await ctx.db.query("activityLogs").order("desc").take(100);
  },
});

export const addLog = mutation({
  args: {
    username: v.string(),
    fullName: v.string(),
    position: v.string(),
    action: v.string(),
    detail: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityLogs", {
      ...args,
      timestamp: new Date().toLocaleString("id-ID"),
    });
  },
});
