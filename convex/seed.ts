import { mutation } from "./_generated/server";

export const seedDatabase = mutation({
  handler: async (ctx) => {
    // Check if accounts exist
    const existing = await ctx.db.query("accounts").first();
    if (existing) {
      return { message: "Database already seeded." };
    }

    // Insert superadmin
    await ctx.db.insert("users", {
      username: "admin",
      password: "Ringgo5t@r",
      fullName: "Administrator",
      position: "Administrator Sistem",
      specialCode: "MASTER-SPECTRA-2026",
      role: "admin",
      isAuthority: true,
      status: "active",
      registeredAt: new Date().toLocaleString("id-ID"),
    });

    // Insert company settings
    await ctx.db.insert("settings", {
      companyName: "PT BARU (CV Max Picture)",
      businessType: "Jasa & Perdagangan",
      fiscalPeriod: "Desember 2021",
      fiscalYear: 2021,
      currency: "IDR",
      taxRatePercent: 11,
      address: "Jl. Bisnis Raya No. 12, Bandung - Jawa Barat",
      phone: "(022) 7890123",
      email: "finance@ptbaru.co.id",
      directorName: "Mazmur Gusti Agung L",
      accountantName: "Chief Financial Officer",
      updatedAt: Date.now(),
    });

    return { message: "Database seeded successfully!" };
  },
});
