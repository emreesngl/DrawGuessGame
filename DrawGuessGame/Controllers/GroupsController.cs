using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using DrawGuessGame.Data;
using DrawGuessGame.Models;

namespace DrawGuessGame.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class GroupsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public GroupsController(AppDbContext context)
        {
            _context = context;
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        }

        [HttpPost("create")]
        public async Task<ActionResult> CreateGroup([FromBody] CreateGroupRequest request)
        {
            var userId = GetCurrentUserId();

            var group = new Group
            {
                Name = request.Name,
                CreatorId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Groups.Add(group);
            await _context.SaveChangesAsync();

            // Yaratıcıyı otomatik ekle (admin olarak)
            var creatorMember = new GroupMember
            {
                GroupId = group.Id,
                UserId = userId,
                IsAdmin = true,
                JoinedAt = DateTime.UtcNow
            };

            _context.GroupMembers.Add(creatorMember);

            // Seçilen arkadaşları ekle
            if (request.MemberIds != null)
            {
                foreach (var memberId in request.MemberIds)
                {
                    var member = new GroupMember
                    {
                        GroupId = group.Id,
                        UserId = memberId,
                        IsAdmin = false,
                        JoinedAt = DateTime.UtcNow
                    };
                    _context.GroupMembers.Add(member);
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { groupId = group.Id, message = "Grup oluşturuldu!" });
        }

        [HttpGet]
        public async Task<ActionResult> GetMyGroups()
        {
            var userId = GetCurrentUserId();

            var groups = await _context.GroupMembers
                .Where(gm => gm.UserId == userId)
                .Include(gm => gm.Group)
                    .ThenInclude(g => g.Members)
                        .ThenInclude(m => m.User)
                .Select(gm => new
                {
                    id = gm.Group.Id,
                    name = gm.Group.Name,
                    creatorId = gm.Group.CreatorId,
                    memberCount = gm.Group.Members.Count,
                    isAdmin = gm.IsAdmin,
                    createdAt = gm.Group.CreatedAt
                })
                .ToListAsync();

            return Ok(groups);
        }

        [HttpGet("{groupId}/members")]
        public async Task<ActionResult> GetGroupMembers(int groupId)
        {
            var userId = GetCurrentUserId();

            // Kullanıcı bu grubun üyesi mi kontrol et
            var isMember = await _context.GroupMembers
                .AnyAsync(gm => gm.GroupId == groupId && gm.UserId == userId);

            if (!isMember)
            {
                return Forbid();
            }

            var members = await _context.GroupMembers
                .Where(gm => gm.GroupId == groupId)
                .Include(gm => gm.User)
                .Select(gm => new
                {
                    id = gm.User.Id,
                    username = gm.User.Username,
                    isOnline = gm.User.IsOnline,
                    isAdmin = gm.IsAdmin
                })
                .ToListAsync();

            return Ok(members);
        }

        [HttpPost("{groupId}/add-member/{userId}")]
        public async Task<ActionResult> AddMember(int groupId, int userId)
        {
            var currentUserId = GetCurrentUserId();

            // Kullanıcı admin mi kontrol et
            var isAdmin = await _context.GroupMembers
                .AnyAsync(gm => gm.GroupId == groupId && gm.UserId == currentUserId && gm.IsAdmin);

            if (!isAdmin)
            {
                return Forbid();
            }

            // Zaten üye mi?
            var alreadyMember = await _context.GroupMembers
                .AnyAsync(gm => gm.GroupId == groupId && gm.UserId == userId);

            if (alreadyMember)
            {
                return BadRequest(new { message = "Kullanıcı zaten üye" });
            }

            var member = new GroupMember
            {
                GroupId = groupId,
                UserId = userId,
                IsAdmin = false
            };

            _context.GroupMembers.Add(member);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Üye eklendi" });
        }

        [HttpDelete("{groupId}/leave")]
        public async Task<ActionResult> LeaveGroup(int groupId)
        {
            var userId = GetCurrentUserId();

            var membership = await _context.GroupMembers
                .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == userId);

            if (membership == null)
            {
                return NotFound();
            }

            _context.GroupMembers.Remove(membership);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Gruptan ayrıldınız" });
        }
    }

    public class CreateGroupRequest
    {
        public string Name { get; set; } = string.Empty;
        public List<int>? MemberIds { get; set; }
    }
}

