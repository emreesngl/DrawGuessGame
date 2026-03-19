using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using DrawGuessGame.Data;
using DrawGuessGame.DTOs;
using DrawGuessGame.Models;

namespace DrawGuessGame.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FriendsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FriendsController(AppDbContext context)
        {
            _context = context;
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        }

        [HttpGet]
        public async Task<ActionResult<List<FriendDTO>>> GetFriends()
        {
            var userId = GetCurrentUserId();

            var friends = await _context.Friendships
                .Where(f => (f.UserId == userId || f.FriendId == userId) && f.Status == FriendshipStatus.Accepted)
                .Include(f => f.User)
                .Include(f => f.Friend)
                .Select(f => new FriendDTO
                {
                    Id = f.UserId == userId ? f.FriendId : f.UserId,
                    Username = f.UserId == userId ? f.Friend.Username : f.User.Username,
                    IsOnline = f.UserId == userId ? f.Friend.IsOnline : f.User.IsOnline,
                    Status = "Accepted",
                    AcceptedAt = f.AcceptedAt
                })
                .ToListAsync();

            return Ok(friends);
        }

        [HttpGet("requests")]
        public async Task<ActionResult<List<FriendDTO>>> GetFriendRequests()
        {
            var userId = GetCurrentUserId();

            var requests = await _context.Friendships
                .Where(f => f.FriendId == userId && f.Status == FriendshipStatus.Pending)
                .Include(f => f.User)
                .Select(f => new FriendDTO
                {
                    Id = f.UserId,
                    Username = f.User.Username,
                    IsOnline = f.User.IsOnline,
                    Status = "Pending",
                    AcceptedAt = null
                })
                .ToListAsync();

            return Ok(requests);
        }

        [HttpPost("send/{friendId}")]
        public async Task<ActionResult> SendFriendRequest(int friendId)
        {
            var userId = GetCurrentUserId();

            if (userId == friendId)
            {
                return BadRequest(new { message = "Kendinize arkadaşlık isteği gönderemezsiniz" });
            }

            var friendExists = await _context.Users.AnyAsync(u => u.Id == friendId);
            if (!friendExists)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı" });
            }

            var existingFriendship = await _context.Friendships
                .FirstOrDefaultAsync(f =>
                    (f.UserId == userId && f.FriendId == friendId) ||
                    (f.UserId == friendId && f.FriendId == userId));

            if (existingFriendship != null)
            {
                return BadRequest(new { message = "Arkadaşlık isteği zaten mevcut" });
            }

            var friendship = new Friendship
            {
                UserId = userId,
                FriendId = friendId,
                Status = FriendshipStatus.Pending,
                RequestedAt = DateTime.UtcNow
            };

            _context.Friendships.Add(friendship);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Arkadaşlık isteği gönderildi" });
        }

        [HttpPost("accept/{friendId}")]
        public async Task<ActionResult> AcceptFriendRequest(int friendId)
        {
            var userId = GetCurrentUserId();

            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => f.UserId == friendId && f.FriendId == userId && f.Status == FriendshipStatus.Pending);

            if (friendship == null)
            {
                return NotFound(new { message = "Arkadaşlık isteği bulunamadı" });
            }

            friendship.Status = FriendshipStatus.Accepted;
            friendship.AcceptedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Arkadaşlık isteği kabul edildi" });
        }

        [HttpPost("decline/{friendId}")]
        public async Task<ActionResult> DeclineFriendRequest(int friendId)
        {
            var userId = GetCurrentUserId();

            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => f.UserId == friendId && f.FriendId == userId && f.Status == FriendshipStatus.Pending);

            if (friendship == null)
            {
                return NotFound(new { message = "Arkadaşlık isteği bulunamadı" });
            }

            friendship.Status = FriendshipStatus.Declined;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Arkadaşlık isteği reddedildi" });
        }

        [HttpDelete("{friendId}")]
        public async Task<ActionResult> RemoveFriend(int friendId)
        {
            var userId = GetCurrentUserId();

            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f =>
                    ((f.UserId == userId && f.FriendId == friendId) ||
                     (f.UserId == friendId && f.FriendId == userId)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (friendship == null)
            {
                return NotFound(new { message = "Arkadaşlık bulunamadı" });
            }

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Arkadaşlık silindi" });
        }

        [HttpGet("search/{username}")]
        public async Task<ActionResult<List<UserDTO>>> SearchUsers(string username)
        {
            var userId = GetCurrentUserId();

            var users = await _context.Users
                .Where(u => u.Username.Contains(username) && u.Id != userId)
                .Take(10)
                .Select(u => new UserDTO
                {
                    Id = u.Id,
                    Username = u.Username,
                    Email = u.Email,
                    IsOnline = u.IsOnline
                })
                .ToListAsync();

            return Ok(users);
        }
    }
}

