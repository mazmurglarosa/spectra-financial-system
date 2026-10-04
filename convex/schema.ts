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
    type: v.optional(v.string()), // general, cash_in, cash_out, sales, purchase, adjustment
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
  })
    .index("by_date", ["date"])
    .index("by_ref", ["refNumber"]),

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
    directorTitle: v.optional(v.string()),
    accountantName: v.string(),
    accountantTitle: v.optional(v.string()),
    preparerName: v.optional(v.string()),
    preparerTitle: v.optional(v.string()),
    approverName: v.optional(v.string()),
    approverTitle: v.optional(v.string()),
    updatedAt: v.number(),
  }),

  users: defineTable({
    username: v.string(),
    password: v.optional(v.string()),
    fullName: v.string(),
    position: v.string(),
    specialCode: v.optional(v.string()),
    role: v.string(), // "admin" | "user"
    isAuthority: v.boolean(),
    status: v.string(), // "active" | "pending"
    registeredAt: v.string(),
  }).index("by_username", ["username"]),

  activityLogs: defineTable({
    timestamp: v.string(),
    username: v.string(),
    fullName: v.string(),
    position: v.string(),
    action: v.string(),
    detail: v.string(),
  }).index("by_username", ["username"]),

  complaints: defineTable({
    timestamp: v.string(),
    username: v.string(),
    fullName: v.string(),
    position: v.string(),
    subject: v.string(),
    message: v.string(),
    status: v.string(), // "pending" | "resolved"
    response: v.optional(v.string()),
    respondedAt: v.optional(v.string()),
  }).index("by_status", ["status"]),

  contacts: defineTable({
    code: v.string(),
    name: v.string(),
    type: v.string(), // "customer" | "vendor"
    phone: v.optional(v.string()),
    balance: v.number(),
  }).index("by_code", ["code"]),
});
