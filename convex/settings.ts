import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getSettings = query({
  handler: async (ctx) => {
    return await ctx.db.query("settings").first();
  },
});

export const updateSettings = mutation({
  args: {
    companyName: v.string(),
    businessType: v.string(),
    fiscalPeriod: v.string(),
    fiscalYear: v.number(),
    currency: v.string(),
    taxRatePercent: v.number(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
    directorName: v.string(),
    accountantName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("settings").first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("settings", {
        ...args,
        updatedAt: now,
      });
    }
  },
});
