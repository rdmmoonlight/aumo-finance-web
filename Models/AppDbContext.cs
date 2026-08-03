using AumoFinance.Models.Security;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Models;

public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>, IDataProtectionKeyContext
{
    public AppDbContext(
        DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    // Data Protection Keys Table
    public DbSet<DataProtectionKey> DataProtectionKeys { get; set; } = null!;

    // Accounting Core
    public DbSet<ChartOfAccount> ChartOfAccounts => Set<ChartOfAccount>();

    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();

    public DbSet<JournalEntryLine> JournalEntryLines => Set<JournalEntryLine>();

    public DbSet<Period> Periods => Set<Period>();

    // Economic Document Repository (BARU)
    public DbSet<EconomicDocument> EconomicDocuments => Set<EconomicDocument>();

    // Guardian
    public DbSet<UserSession> UserSessions => Set<UserSession>();

    public DbSet<LoginActivity> LoginActivities => Set<LoginActivity>();

    // Mobile Input (tabel terpisah dari JournalEntries/JournalEntryLines).
    // Semua input dari Android masuk ke sini dulu, digabung ke tabel utama
    // hanya lewat mekanisme verifikasi di halaman web "Mobile Classification".
    public DbSet<MobileJournalEntry> MobileJournalEntries => Set<MobileJournalEntry>();

    public DbSet<MobileJournalEntryLine> MobileJournalEntryLines => Set<MobileJournalEntryLine>();


    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ChartOfAccount>(entity =>
        {
            // Nomor referensi hanya unik DALAM satu user — bukan global lagi,
            // karena setiap user punya Chart of Accounts sendiri.
            entity.HasIndex(x => new { x.UserId, x.ReferenceNumber })
                .IsUnique();
        });

        builder.Entity<JournalEntry>(entity =>
        {
            entity.HasMany(x => x.Lines)
                .WithOne(x => x.JournalEntry)
                .HasForeignKey(x => x.JournalEntryId)
                .OnDelete(DeleteBehavior.Cascade);

            // Nomor referensi (GJ-xxxxxx / AJE-xxxxxx) hanya unik DALAM satu
            // user — setiap user punya penomoran sendiri, mulai dari 1.
            entity.HasIndex(x => new { x.UserId, x.ReferenceNumber })
                .IsUnique();
        });

        builder.Entity<JournalEntryLine>(entity =>
        {
            entity.HasOne(x => x.Account)
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Document Repository Indexing (BARU - Mempercepat pencarian)
        builder.Entity<EconomicDocument>(entity =>
        {
            entity.HasIndex(x => x.Category);
            entity.HasIndex(x => x.ReferenceNumber);
            entity.HasIndex(x => x.UserId);
        });

        // Guardian Session
        builder.Entity<UserSession>(entity =>
        {
            entity.HasIndex(x => new
            {
                x.UserId,
                x.IsActive
            });

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Guardian Activity
        builder.Entity<LoginActivity>(entity =>
        {
            entity.HasIndex(x => new
            {
                x.UserId,
                x.CreatedAt
            });

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Mobile Input
        builder.Entity<MobileJournalEntry>(entity =>
        {
            entity.HasIndex(x => x.Status);

            entity.HasOne(x => x.VerifiedJournalEntry)
                .WithMany()
                .HasForeignKey(x => x.VerifiedJournalEntryId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<MobileJournalEntryLine>(entity =>
        {
            entity.HasOne(x => x.MobileJournalEntry)
                .WithMany(x => x.Lines)
                .HasForeignKey(x => x.MobileJournalEntryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Account)
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
