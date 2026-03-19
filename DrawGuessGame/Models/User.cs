using System.ComponentModel.DataAnnotations;

namespace DrawGuessGame.Models
{
    public class User
    {
        public int Id { get; set; }
        
        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;
        
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string PasswordHash { get; set; } = string.Empty;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? LastLoginAt { get; set; }
        
        public bool IsOnline { get; set; }
        
        public string? ConnectionId { get; set; }

        // İlişkiler
        public ICollection<Friendship> FriendsInitiated { get; set; } = new List<Friendship>();
        public ICollection<Friendship> FriendsReceived { get; set; } = new List<Friendship>();
        public ICollection<ChatMessage> SentMessages { get; set; } = new List<ChatMessage>();
        public ICollection<ChatMessage> ReceivedMessages { get; set; } = new List<ChatMessage>();
        public ICollection<Group> CreatedGroups { get; set; } = new List<Group>();
        public ICollection<GroupMember> GroupMemberships { get; set; } = new List<GroupMember>();
        public ICollection<GroupMessage> GroupMessages { get; set; } = new List<GroupMessage>();
    }

    public class Friendship
    {
        public int Id { get; set; }
        
        public int UserId { get; set; }
        public User User { get; set; } = null!;
        
        public int FriendId { get; set; }
        public User Friend { get; set; } = null!;
        
        public FriendshipStatus Status { get; set; }
        
        public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? AcceptedAt { get; set; }
    }

    public enum FriendshipStatus
    {
        Pending,
        Accepted,
        Declined,
        Blocked
    }

    public class ChatMessage
    {
        public int Id { get; set; }
        
        public int SenderId { get; set; }
        public User Sender { get; set; } = null!;
        
        public int ReceiverId { get; set; }
        public User Receiver { get; set; } = null!;
        
        [Required]
        [StringLength(1000)]
        public string Message { get; set; } = string.Empty;
        
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        
        public bool IsRead { get; set; }
    }
}

