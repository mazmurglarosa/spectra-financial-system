import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const getUserByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
  },
});

export const registerUser = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    fullName: v.string(),
    position: v.string(),
    specialCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.trim()))
      .first();

    if (existing) {
      throw new Error("Username sudah terdaftar.");
    }

    const isAuthority = (args.specialCode || "").toUpperCase() === "OTORITAS-NBE";
    const status = isAuthority ? "active" : "pending";

    return await ctx.db.insert("users", {
      username: args.username.trim(),
      password: args.password,
      fullName: args.fullName.trim(),
      position: args.position.trim(),
      specialCode: args.specialCode,
      role: "user",
      isAuthority,
      status,
      registeredAt: new Date().toLocaleString("id-ID"),
    });
  },
});

export const approveUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "active" });
  },
});

export const rejectUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
