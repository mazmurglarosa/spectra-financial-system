import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAccounts = query({
  handler: async (ctx) => {
    return await ctx.db.query("accounts").order("asc").collect();
  },
});

export const addAccount = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    category: v.string(),
    categoryName: v.string(),
    pos: v.string(),
    sn: v.string(),
    debetAwal: v.number(),
    kreditAwal: v.number(),
    description: v.optional(v.string()),
    isHeader: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("accounts", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const updateAccount = mutation({
  args: {
    id: v.id("accounts"),
    name: v.string(),
    debetAwal: v.number(),
    kreditAwal: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      updatedAt: Date.now(),
    });
  },
});

export const deleteAccount = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
