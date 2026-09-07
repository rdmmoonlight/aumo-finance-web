using AumoFinance.Models.Guardian; // Ditunjuk ke namespace baru
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

    // Economic Document Repository
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
            entity.HasIndex(x => new { x.UserId, x.ReferenceNumber })
                .IsUnique();
        });

        builder.Entity<JournalEntry>(entity =>
        {
            entity.HasMany(x => x.Lines)
                .WithOne(x => x.JournalEntry)
                .HasForeignKey(x => x.JournalEntryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.UserId, x.TransactionNumber })
                .IsUnique();
        });

        builder.Entity<TransactionCounter>(entity =>
        {
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

        // Document Repository Indexing
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

            entity.HasOne<ApplicationUser>()
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

            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
