using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using DrawGuessGame.Data;
using DrawGuessGame.Models;
using DrawGuessGame.DTOs;

namespace DrawGuessGame.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly AppDbContext _context;

        public ChatHub(AppDbContext context)
        {
            _context = context;
        }

        private int GetCurrentUserId()
        {
            return int.Parse(Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        }

        public override async Task OnConnectedAsync()
        {
            var userId = GetCurrentUserId();
            Console.WriteLine($"[CHAT HUB] User {userId} ChatHub'a bağlandı (ConnId: {Context.ConnectionId})");
            
            var user = await _context.Users.FindAsync(userId);

            if (user != null)
            {
                user.IsOnline = true;
                user.ConnectionId = Context.ConnectionId;
                await _context.SaveChangesAsync();
                
                Console.WriteLine($"[CHAT HUB] ✅ {user.Username} online oldu ve ConnectionId güncellendi: {Context.ConnectionId}");

                // bekleyen mesaj sayısını kontrol et
                var unreadCount = await _context.ChatMessages
                    .Where(m => m.ReceiverId == userId && !m.IsRead)
                    .CountAsync();
                
                if (unreadCount > 0)
                {
                    await Clients.Caller.SendAsync("UnreadMessagesCount", unreadCount);
                    Console.WriteLine($"[CHAT HUB] 📬 {user.Username} için {unreadCount} okunmamış mesaj bildirimi gönderildi");
                }

                // arkadaşlara online durumunu bildir
                var friendIds = await GetFriendConnectionIds(userId);
                Console.WriteLine($"[CHAT HUB] {friendIds.Count} arkadaşa online bildirimi gönderiliyor");
                await Clients.Clients(friendIds).SendAsync("FriendOnline", userId, user.Username);
            }
            else
            {
                Console.WriteLine($"[CHAT HUB] ❌ User {userId} veritabanında bulunamadı!");
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FindAsync(userId);

            if (user != null)
            {
                user.IsOnline = false;
                user.ConnectionId = null;
                await _context.SaveChangesAsync();

                // arkadaşlara offline durumunu bildir
                var friendIds = await GetFriendConnectionIds(userId);
                await Clients.Clients(friendIds).SendAsync("FriendOffline", userId, user.Username);
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendPrivateMessage(int receiverId, string message)
        {
            var senderId = GetCurrentUserId();

            Console.WriteLine($"[CHAT] Mesaj gönderiliyor: User {senderId} → User {receiverId}");

            // arkadaş mı kontrol et
            var areFriends = await _context.Friendships
                .AnyAsync(f =>
                    ((f.UserId == senderId && f.FriendId == receiverId) ||
                     (f.UserId == receiverId && f.FriendId == senderId)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (!areFriends)
            {
                Console.WriteLine($"[CHAT] ❌ Arkadaş değiller!");
                await Clients.Caller.SendAsync("Error", "Bu kullanıcıya mesaj gönderemezsiniz");
                return;
            }

            var sender = await _context.Users.FindAsync(senderId);
            var receiver = await _context.Users.FindAsync(receiverId);

            if (sender == null || receiver == null)
            {
                Console.WriteLine($"[CHAT] ❌ Gönderen veya alıcı bulunamadı!");
                return;
            }

            Console.WriteLine($"[CHAT] Gönderen: {sender.Username} (ConnId: {sender.ConnectionId})");
            Console.WriteLine($"[CHAT] Alıcı: {receiver.Username} (ConnId: {receiver.ConnectionId})");

            var chatMessage = new ChatMessage
            {
                SenderId = senderId,
                ReceiverId = receiverId,
                Message = message,
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.ChatMessages.Add(chatMessage);
            await _context.SaveChangesAsync();

            var messageDto = new MessageDTO
            {
                Id = chatMessage.Id,
                SenderId = senderId,
                SenderUsername = sender.Username,
                ReceiverId = receiverId,
                ReceiverUsername = receiver.Username,
                Message = message,
                SentAt = chatMessage.SentAt,
                IsRead = false
            };

            // gönderene geri bildir
            Console.WriteLine($"[CHAT] ✅ Caller'a (gönderen) mesaj gönderiliyor...");
            await Clients.Caller.SendAsync("ReceivePrivateMessage", messageDto);

            // alıcıya gönder (online ise)
            if (!string.IsNullOrEmpty(receiver.ConnectionId))
            {
                Console.WriteLine($"[CHAT] ✅ Alıcıya mesaj gönderiliyor (ConnId: {receiver.ConnectionId})");
                await Clients.Client(receiver.ConnectionId).SendAsync("ReceivePrivateMessage", messageDto);
            }
            else
            {
                Console.WriteLine($"[CHAT] ❌ Alıcı offline veya ConnectionId yok!");
            }
        }

        public async Task<List<MessageDTO>> GetChatHistory(int friendId, int skip = 0, int take = 50)
        {
            var userId = GetCurrentUserId();

            // mesajları okundu olarak işaretle (arkadaştan gelenleri)
            var unreadMessages = await _context.ChatMessages
                .Where(m => m.SenderId == friendId && m.ReceiverId == userId && !m.IsRead)
                .ToListAsync();
            
            foreach (var msg in unreadMessages)
            {
                msg.IsRead = true;
            }
            
            if (unreadMessages.Any())
            {
                await _context.SaveChangesAsync();
                Console.WriteLine($"[CHAT] ✅ {unreadMessages.Count} mesaj okundu olarak işaretlendi");
            }

            var messages = await _context.ChatMessages
                .Where(m =>
                    (m.SenderId == userId && m.ReceiverId == friendId) ||
                    (m.SenderId == friendId && m.ReceiverId == userId))
                .OrderByDescending(m => m.SentAt)
                .Skip(skip)
                .Take(take)
                .Include(m => m.Sender)
                .Include(m => m.Receiver)
                .Select(m => new MessageDTO
                {
                    Id = m.Id,
                    SenderId = m.SenderId,
                    SenderUsername = m.Sender.Username,
                    ReceiverId = m.ReceiverId,
                    ReceiverUsername = m.Receiver.Username,
                    Message = m.Message,
                    SentAt = m.SentAt,
                    IsRead = m.IsRead
                })
                .ToListAsync();

            return messages.OrderBy(m => m.SentAt).ToList();
        }

        public async Task MarkAsRead(int messageId)
        {
            var message = await _context.ChatMessages.FindAsync(messageId);

            if (message != null && message.ReceiverId == GetCurrentUserId())
            {
                message.IsRead = true;
                await _context.SaveChangesAsync();
            }
        }

        public async Task StartTyping(int receiverId)
        {
            var senderId = GetCurrentUserId();
            var receiver = await _context.Users.FindAsync(receiverId);

            if (receiver != null && !string.IsNullOrEmpty(receiver.ConnectionId))
            {
                await Clients.Client(receiver.ConnectionId).SendAsync("UserTyping", senderId);
            }
        }

        public async Task StopTyping(int receiverId)
        {
            var senderId = GetCurrentUserId();
            var receiver = await _context.Users.FindAsync(receiverId);

            if (receiver != null && !string.IsNullOrEmpty(receiver.ConnectionId))
            {
                await Clients.Client(receiver.ConnectionId).SendAsync("UserStoppedTyping", senderId);
            }
        }

        public async Task SendGameInvite(int friendId, string roomCode)
        {
            var senderId = GetCurrentUserId();
            var sender = await _context.Users.FindAsync(senderId);
            var receiver = await _context.Users.FindAsync(friendId);

            if (sender == null || receiver == null) return;

            // arkadaş mı kontrol et
            var areFriends = await _context.Friendships
                .AnyAsync(f =>
                    ((f.UserId == senderId && f.FriendId == friendId) ||
                     (f.UserId == friendId && f.FriendId == senderId)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (!areFriends) return;

            // online ise davet gönder
            if (!string.IsNullOrEmpty(receiver.ConnectionId))
            {
                await Clients.Client(receiver.ConnectionId).SendAsync("GameInviteReceived", new
                {
                    senderName = sender.Username,
                    roomCode = roomCode
                });
            }
        }

        // GRUP MESAJLAŞMA
        public async Task SendGroupMessage(int groupId, string message)
        {
            var senderId = GetCurrentUserId();
            
            // kullanıcı bu grubun üyesi mi?
            var isMember = await _context.GroupMembers
                .AnyAsync(gm => gm.GroupId == groupId && gm.UserId == senderId);
            
            if (!isMember)
            {
                await Clients.Caller.SendAsync("Error", "Bu gruba mesaj gönderemezsiniz");
                return;
            }
            
            var sender = await _context.Users.FindAsync(senderId);
            if (sender == null) return;
            
            var groupMessage = new GroupMessage
            {
                GroupId = groupId,
                SenderId = senderId,
                Message = message,
                SentAt = DateTime.UtcNow
            };
            
            _context.GroupMessages.Add(groupMessage);
            await _context.SaveChangesAsync();
            
            // gruptaki tüm online üyelere gönder
            var memberConnectionIds = await _context.GroupMembers
                .Where(gm => gm.GroupId == groupId)
                .Include(gm => gm.User)
                .Where(gm => !string.IsNullOrEmpty(gm.User.ConnectionId))
                .Select(gm => gm.User.ConnectionId)
                .ToListAsync();
            
            var messageData = new
            {
                id = groupMessage.Id,
                groupId = groupId,
                senderId = senderId,
                senderUsername = sender.Username,
                message = message,
                sentAt = groupMessage.SentAt
            };
            
            await Clients.Clients(memberConnectionIds!).SendAsync("ReceiveGroupMessage", messageData);
        }
        
        public async Task<object> GetGroupChatHistory(int groupId, int skip = 0, int take = 50)
        {
            var userId = GetCurrentUserId();
            
            // üye kontrolü
            var isMember = await _context.GroupMembers
                .AnyAsync(gm => gm.GroupId == groupId && gm.UserId == userId);
            
            if (!isMember) return new { };
            
            var messages = await _context.GroupMessages
                .Where(gm => gm.GroupId == groupId)
                .OrderByDescending(gm => gm.SentAt)
                .Skip(skip)
                .Take(take)
                .Include(gm => gm.Sender)
                .Select(gm => new
                {
                    id = gm.Id,
                    groupId = gm.GroupId,
                    senderId = gm.SenderId,
                    senderUsername = gm.Sender.Username,
                    message = gm.Message,
                    sentAt = gm.SentAt
                })
                .ToListAsync();
            
            return messages.OrderBy(m => m.sentAt).ToList();
        }

        private async Task<List<string>> GetFriendConnectionIds(int userId)
        {
            var friendConnectionIds = await _context.Friendships
                .Where(f => (f.UserId == userId || f.FriendId == userId) && f.Status == FriendshipStatus.Accepted)
                .Include(f => f.User)
                .Include(f => f.Friend)
                .Select(f => f.UserId == userId ? f.Friend.ConnectionId : f.User.ConnectionId)
                .Where(connId => !string.IsNullOrEmpty(connId))
                .ToListAsync();

            return friendConnectionIds!;
        }
    }
}

