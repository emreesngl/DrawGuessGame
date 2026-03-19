using Microsoft.EntityFrameworkCore;
using DrawGuessGame.Models;

namespace DrawGuessGame.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Friendship> Friendships { get; set; }
        public DbSet<ChatMessage> ChatMessages { get; set; }
        public DbSet<Group> Groups { get; set; }
        public DbSet<GroupMember> GroupMembers { get; set; }
        public DbSet<GroupMessage> GroupMessages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // User configuration
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(e => e.Username).IsUnique();
                entity.HasIndex(e => e.Email).IsUnique();
            });

            // Friendship configuration
            modelBuilder.Entity<Friendship>(entity =>
            {
                entity.HasOne(f => f.User)
                    .WithMany(u => u.FriendsInitiated)
                    .HasForeignKey(f => f.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(f => f.Friend)
                    .WithMany(u => u.FriendsReceived)
                    .HasForeignKey(f => f.FriendId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => new { e.UserId, e.FriendId }).IsUnique();
            });

            // ChatMessage configuration
            modelBuilder.Entity<ChatMessage>(entity =>
            {
                entity.HasOne(m => m.Sender)
                    .WithMany(u => u.SentMessages)
                    .HasForeignKey(m => m.SenderId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(m => m.Receiver)
                    .WithMany(u => u.ReceivedMessages)
                    .HasForeignKey(m => m.ReceiverId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => e.SentAt);
            });

            // Group configuration
            modelBuilder.Entity<Group>(entity =>
            {
                entity.HasOne(g => g.Creator)
                    .WithMany(u => u.CreatedGroups)
                    .HasForeignKey(g => g.CreatorId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // GroupMember configuration
            modelBuilder.Entity<GroupMember>(entity =>
            {
                entity.HasOne(gm => gm.Group)
                    .WithMany(g => g.Members)
                    .HasForeignKey(gm => gm.GroupId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(gm => gm.User)
                    .WithMany(u => u.GroupMemberships)
                    .HasForeignKey(gm => gm.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => new { e.GroupId, e.UserId }).IsUnique();
            });

            // GroupMessage configuration
            modelBuilder.Entity<GroupMessage>(entity =>
            {
                entity.HasOne(gm => gm.Group)
                    .WithMany(g => g.Messages)
                    .HasForeignKey(gm => gm.GroupId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(gm => gm.Sender)
                    .WithMany(u => u.GroupMessages)
                    .HasForeignKey(gm => gm.SenderId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => e.SentAt);
            });
        }
    }
}

