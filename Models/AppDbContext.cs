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

    public DbSet<TransactionCounter> TransactionCounters => Set<TransactionCounter>();

    public DbSet<Period> Periods => Set<Period>();

    // Economic Document Repository (BARU)
    public DbSet<EconomicDocument> EconomicDocuments => Set<EconomicDocument>();

    // Struktur folder untuk Document Repository
    public DbSet<Folder> Folders => Set<Folder>();

    // Guardian
    public DbSet<UserSession> UserSessions => Set<UserSession>();

    public DbSet<LoginActivity> LoginActivities => Set<LoginActivity>();


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

            // Nomor transaksi (GJ26080001 / AJ26080001, format
            // PREFIX+YYMM+SEQUENCE 4 digit) hanya unik DALAM satu user —
            // setiap user punya penomoran sendiri.
            entity.HasIndex(x => new { x.UserId, x.TransactionNumber })
                .IsUnique();
        });

        builder.Entity<TransactionCounter>(entity =>
        {
            // Satu counter per user per (prefix + periode). Unique constraint
            // ini yang membuat UPSERT atomik di TransactionNumberService aman
            // terhadap concurrent request — lihat ON CONFLICT (UserId, CounterKey).
            entity.HasIndex(x => new { x.UserId, x.CounterKey })
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
            entity.HasIndex(x => x.FolderId);

            entity.HasOne(x => x.Folder)
                .WithMany()
                .HasForeignKey(x => x.FolderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Folder (struktur direktori Document Repository)
        builder.Entity<Folder>(entity =>
        {
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => x.ParentFolderId);

            entity.HasOne(x => x.ParentFolder)
                .WithMany()
                .HasForeignKey(x => x.ParentFolderId)
                .OnDelete(DeleteBehavior.Cascade);
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
    }
}
