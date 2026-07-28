using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Models
{
    public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) 
            : base(options) 
        {
        }

        // Accounting
        public DbSet<ChartOfAccount> ChartOfAccounts => Set<ChartOfAccount>();
        public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
        public DbSet<JournalEntryLine> JournalEntryLines => Set<JournalEntryLine>();
        public DbSet<Period> Periods { get; set; }


        // Guardian Security
        public DbSet<UserSession> UserSessions => Set<UserSession>();
        public DbSet<TrustedDevice> TrustedDevices => Set<TrustedDevice>();
        public DbSet<LoginActivity> LoginActivities => Set<LoginActivity>();
        public DbSet<RecoveryCode> RecoveryCodes => Set<RecoveryCode>();
        public DbSet<SecuritySetting> SecuritySettings => Set<SecuritySetting>();


        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);


            // ==========================================
            // Chart Of Accounts
            // ==========================================

            builder.Entity<ChartOfAccount>(entity =>
            {
                entity.HasIndex(a => a.ReferenceNumber)
                      .IsUnique();
            });


            // ==========================================
            // Journal Entry
            // ==========================================

            builder.Entity<JournalEntry>(entity =>
            {
                entity.HasMany(j => j.Lines)
                      .WithOne(l => l.JournalEntry)
                      .HasForeignKey(l => l.JournalEntryId)
                      .OnDelete(DeleteBehavior.Cascade);
            });


            builder.Entity<JournalEntryLine>(entity =>
            {
                entity.HasOne(l => l.Account)
                      .WithMany()
                      .HasForeignKey(l => l.AccountId)
                      .OnDelete(DeleteBehavior.Restrict);
            });


            // ==========================================
            // Guardian - User Session
            // ==========================================

            builder.Entity<UserSession>(entity =>
            {
                entity.HasKey(x => x.Id);

                entity.HasIndex(x => x.UserId);

                entity.HasIndex(x => x.RefreshTokenHash)
                      .IsUnique();

                entity.Property(x => x.DeviceName)
                      .HasMaxLength(100);

                entity.Property(x => x.Browser)
                      .HasMaxLength(100);

                entity.Property(x => x.IpAddress)
                      .HasMaxLength(50);
            });


            // ==========================================
            // Guardian - Trusted Device
            // ==========================================

            builder.Entity<TrustedDevice>(entity =>
            {
                entity.HasKey(x => x.Id);

                entity.HasIndex(x => x.UserId);

                entity.HasIndex(x => x.DeviceIdentifier)
                      .IsUnique();

                entity.Property(x => x.DeviceName)
                      .HasMaxLength(100);

                entity.Property(x => x.Browser)
                      .HasMaxLength(100);

                entity.Property(x => x.OperatingSystem)
                      .HasMaxLength(100);
            });


            // ==========================================
            // Guardian - Login Activity
            // ==========================================

            builder.Entity<LoginActivity>(entity =>
            {
                entity.HasKey(x => x.Id);

                entity.HasIndex(x => x.UserId);

                entity.Property(x => x.ActivityType)
                      .HasMaxLength(100);

                entity.Property(x => x.Device)
                      .HasMaxLength(100);

                entity.Property(x => x.IpAddress)
                      .HasMaxLength(50);
            });


            // ==========================================
            // Guardian - Recovery Code
            // ==========================================

            builder.Entity<RecoveryCode>(entity =>
            {
                entity.HasKey(x => x.Id);

                entity.HasIndex(x => x.UserId);

                entity.Property(x => x.CodeHash)
                      .HasMaxLength(255);
            });


            // ==========================================
            // Guardian - Security Setting
            // ==========================================

            builder.Entity<SecuritySetting>(entity =>
            {
                entity.HasKey(x => x.UserId);

                entity.Property(x => x.SessionTimeoutMinutes)
                      .HasDefaultValue(30);
            });
        }
    }
}
