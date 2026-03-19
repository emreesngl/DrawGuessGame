using System.ComponentModel.DataAnnotations;

namespace DrawGuessGame.Models
{
    public class Group
    {
        public int Id { get; set; }
        
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;
        
        public int CreatorId { get; set; }
        public User Creator { get; set; } = null!;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public ICollection<GroupMember> Members { get; set; } = new List<GroupMember>();
        public ICollection<GroupMessage> Messages { get; set; } = new List<GroupMessage>();
    }

    public class GroupMember
    {
        public int Id { get; set; }
        
        public int GroupId { get; set; }
        public Group Group { get; set; } = null!;
        
        public int UserId { get; set; }
        public User User { get; set; } = null!;
        
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
        
        public bool IsAdmin { get; set; } = false;
    }

    public class GroupMessage
    {
        public int Id { get; set; }
        
        public int GroupId { get; set; }
        public Group Group { get; set; } = null!;
        
        public int SenderId { get; set; }
        public User Sender { get; set; } = null!;
        
        [Required]
        [StringLength(1000)]
        public string Message { get; set; } = string.Empty;
        
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }
}

