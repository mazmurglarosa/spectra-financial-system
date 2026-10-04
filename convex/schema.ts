import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  accounts: defineTable({
    code: v.string(),
    name: v.string(),
    category: v.string(),
    categoryName: v.string(),
    pos: v.string(), // "Nrc" | "Lr"
    sn: v.string(), // "Db" | "Kr"
    debetAwal: v.number(),
    kreditAwal: v.number(),
    description: v.optional(v.string()),
    isHeader: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
  }).index("by_code", ["code"]),

  transactions: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
    tags: v.optional(v.array(v.string())),
  }).index("by_date", ["date"]),

  settings: defineTable({
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
    updatedAt: v.number(),
  }),
});
