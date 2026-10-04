import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getTransactions = query({
  handler: async (ctx) => {
    return await ctx.db.query("transactions").order("desc").collect();
  },
});

export const addTransaction = mutation({
  args: {
    date: v.string(),
    refNumber: v.string(),
    description: v.string(),
    partner: v.optional(v.string()),
    lines: v.array(
      v.object({
        id: v.string(),
        accountId: v.string(),
        accountCode: v.string(),
        accountName: v.string(),
        debit: v.number(),
        credit: v.number(),
        memo: v.optional(v.string()),
      })
    ),
    totalDebit: v.number(),
    totalCredit: v.number(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("transactions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTransaction = mutation({
  args: {
    id: v.id("transactions"),
    date: v.string(),
    refNumber: v.string(),
    description: v.string(),
    partner: v.optional(v.string()),
    lines: v.array(
      v.object({
        id: v.string(),
        accountId: v.string(),
        accountCode: v.string(),
        accountName: v.string(),
        debit: v.number(),
        credit: v.number(),
        memo: v.optional(v.string()),
      })
    ),
    totalDebit: v.number(),
    totalCredit: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      updatedAt: Date.now(),
    });
  },
});

export const deleteTransaction = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
