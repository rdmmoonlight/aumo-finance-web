using AumoFinance.Models.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Models;

public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }


    public DbSet<ChartOfAccount> ChartOfAccounts => Set<ChartOfAccount>();

    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();

    public DbSet<JournalEntryLine> JournalEntryLines => Set<JournalEntryLine>();

    public DbSet<Period> Periods => Set<Period>();


    // Guardian Security
    public DbSet<UserSession> UserSessions => Set<UserSession>();

    public DbSet<LoginActivity> LoginActivities => Set<LoginActivity>();



    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);



        builder.Entity<ChartOfAccount>(entity =>
        {
            entity.HasIndex(x => x.ReferenceNumber)
                .IsUnique();
        });



        builder.Entity<JournalEntry>(entity =>
        {
            entity.HasMany(x => x.Lines)
                .WithOne(x => x.JournalEntry)
                .HasForeignKey(x => x.JournalEntryId)
                .OnDelete(DeleteBehavior.Cascade);
        });



        builder.Entity<JournalEntryLine>(entity =>
        {
            entity.HasOne(x => x.Account)
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });



        // ============================
        // Guardian User Session
        // ============================

        builder.Entity<UserSession>(entity =>
        {
            entity.HasKey(x => x.Id);


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



        // ============================
        // Guardian Login Activity
        // ============================

        builder.Entity<LoginActivity>(entity =>
        {
            entity.HasKey(x => x.Id);


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

        builder.Entity<ChartOfAccount>(entity =>
        {
            entity.HasIndex(x => x.ReferenceNumber)
                .IsUnique();
        });



        builder.Entity<JournalEntry>(entity =>
        {
            entity.HasMany(x => x.Lines)
                .WithOne(x => x.JournalEntry)
                .HasForeignKey(x => x.JournalEntryId)
                .OnDelete(DeleteBehavior.Cascade);
        });



        builder.Entity<JournalEntryLine>(entity =>
        {
            entity.HasOne(x => x.Account)
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
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
}        public DbSet<RecoveryCode> RecoveryCodes => Set<RecoveryCode>();

        public DbSet<SecuritySetting> SecuritySettings => Set<SecuritySetting>();


        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);


            // ==========================================
            // Chart Of Accounts
            // ==========================================

            builder.Entity<ChartOfAccount>(entity =>
            {
                entity.HasIndex(x => x.ReferenceNumber)
                      .IsUnique();
            });


            // ==========================================
            // Journal Entry
            // ==========================================

            builder.Entity<JournalEntry>(entity =>
            {
                entity.HasMany(x => x.Lines)
                      .WithOne(x => x.JournalEntry)
                      .HasForeignKey(x => x.JournalEntryId)
                      .OnDelete(DeleteBehavior.Cascade);
            });


            // ==========================================
            // Journal Entry Line - COA
            // ==========================================

            builder.Entity<JournalEntryLine>(entity =>
            {
                entity.HasOne(x => x.Account)
                      .WithMany()
                      .HasForeignKey(x => x.AccountId)
                      .OnDelete(DeleteBehavior.Restrict);
            });


            // ==========================================
            // Guardian - User Session
            // ==========================================

            builder.Entity<UserSession>(entity =>
            {
                entity.HasKey(x => x.Id);

                entity.HasOne(x => x.User)
                      .WithMany()
                      .HasForeignKey(x => x.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(x => x.UserId);

                entity.HasIndex(x => x.RefreshTokenHash)
                      .IsUnique();

                entity.Property(x => x.DeviceName)
                      .HasMaxLength(100);

                entity.Property(x => x.Browser)
                      .HasMaxLength(100);

                entity.Property(x => x.IpAddress)
                      .HasMaxLength(50);

                entity.Property(x => x.Country)
                      .HasMaxLength(100);

                entity.Property(x => x.RefreshTokenHash)
                      .HasMaxLength(255);
            });


            // ==========================================
            // Guardian - Trusted Device
            // ==========================================

            builder.Entity<TrustedDevice>(entity =>
            {
                entity.HasKey(x => x.Id);

                entity.HasOne(x => x.User)
                      .WithMany()
                      .HasForeignKey(x => x.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(x => x.UserId);

                entity.HasIndex(x => x.DeviceIdentifier)
                      .IsUnique();

                entity.Property(x => x.DeviceName)
                      .HasMaxLength(100);

                entity.Property(x => x.DeviceIdentifier)
                      .HasMaxLength(255);

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

                entity.HasOne(x => x.User)
                      .WithMany()
                      .HasForeignKey(x => x.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(x => x.UserId);

                entity.Property(x => x.ActivityType)
                      .HasMaxLength(100);

                entity.Property(x => x.Device)
                      .HasMaxLength(100);

                entity.Property(x => x.Browser)
                      .HasMaxLength(100);

                entity.Property(x => x.IpAddress)
                      .HasMaxLength(50);

                entity.Property(x => x.Country)
                      .HasMaxLength(100);
            });


            // ==========================================
            // Guardian - Recovery Code
            // ==========================================

            builder.Entity<RecoveryCode>(entity =>
            {
                entity.HasKey(x => x.Id);

                entity.HasOne(x => x.User)
                      .WithMany()
                      .HasForeignKey(x => x.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

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

                entity.HasOne(x => x.User)
                      .WithOne()
                      .HasForeignKey<SecuritySetting>(x => x.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.Property(x => x.SessionTimeoutMinutes)
                      .HasDefaultValue(30);
            });
        }
    }
}
