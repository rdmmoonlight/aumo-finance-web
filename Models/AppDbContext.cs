using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Models
{
    public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<ChartOfAccount> ChartOfAccounts => Set<ChartOfAccount>();
        public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
        public DbSet<JournalEntryLine> JournalEntryLines => Set<JournalEntryLine>();
        public DbSet<Period> Periods { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<ChartOfAccount>(entity =>
            {
                entity.HasIndex(a => a.ReferenceNumber).IsUnique();
            });

            builder.Entity<JournalEntry>(entity =>
            {
                entity.HasMany(j => j.Lines)
                      .WithOne(l => l.JournalEntry)
                      .HasForeignKey(l => l.JournalEntryId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<JournalEntryLine>(entity =>
            {
                // Setiap baris jurnal WAJIB merujuk ke satu akun di Chart of
                // Account. Relasi ini yang membuat nomor referensi COA bisa
                // "otomatis muncul" di General Journal maupun General Ledger.
                entity.HasOne(l => l.Account)
                      .WithMany()
                      .HasForeignKey(l => l.AccountId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}
