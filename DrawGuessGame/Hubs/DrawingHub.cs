using Microsoft.AspNetCore.SignalR;
using DrawGuessGame.Models;
using System.Collections.Concurrent;

namespace DrawGuessGame.Hubs
{
    public partial class DrawingHub : Hub
    {
        private static ConcurrentDictionary<string, GameRoom> _rooms = new();
        private static ConcurrentDictionary<string, Player> _players = new();
        private static readonly string[] _words = new[]
        {
            "kedi", "köpek", "araba", "ev", "ağaç", "güneş", "ay", "yıldız", "balık", "kuş",
            "çiçek", "deniz", "dağ", "elma", "armut", "telefon", "bilgisayar", "kalp", "göz", "kulak",
            "uçak", "gemi", "tren", "bisiklet", "masa", "sandalye", "kalem", "kitap", "top", "ayakkabı",
            "şapka", "gözlük", "saat", "kamera", "müzik", "dans", "yemek", "içmek", "uyumak", "koşmak",
            "gülmek", "ağlamak", "okumak", "yazmak", "çizmek", "boyamak", "oynamak", "şarkı", "dans", "spor"
        };

        public async Task JoinRoom(string roomCode, string playerName)
        {
            var room = _rooms.GetOrAdd(roomCode, new GameRoom { RoomCode = roomCode });
            
            // İlk katılan kişi oda sahibi
            if (string.IsNullOrEmpty(room.OwnerId))
            {
                room.OwnerId = Context.ConnectionId;
            }
            
            var player = new Player
            {
                ConnectionId = Context.ConnectionId,
                Name = playerName,
                Score = 0,
                IsReady = false
            };

            _players[Context.ConnectionId] = player;
            room.Players.TryAdd(Context.ConnectionId, player);

            await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);
            
            // Tüm oyunculara yeni oyuncuyu bildir
            await Clients.Group(roomCode).SendAsync("PlayerJoined", new
            {
                player = player,
                isOwner = Context.ConnectionId == room.OwnerId
            });
            
            // Odaya katılan oyuncuya oda bilgilerini gönder
            await Clients.Caller.SendAsync("RoomJoined", new
            {
                roomCode = room.RoomCode,
                isOwner = Context.ConnectionId == room.OwnerId,
                isStarted = room.IsStarted,
                players = room.Players.Values.Select(p => new
                {
                    connectionId = p.ConnectionId,
                    name = p.Name,
                    score = p.Score,
                    isReady = p.IsReady,
                    isOwner = p.ConnectionId == room.OwnerId
                }).ToList()
            });

            // Lobby durumunu güncelle
            await UpdateLobbyStatus(roomCode);
        }

        public async Task ToggleReady(string roomCode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;
            if (!_players.TryGetValue(Context.ConnectionId, out var player)) return;
            
            // Oda sahibi hazır butonuna basamaz
            if (Context.ConnectionId == room.OwnerId)
            {
                await Clients.Caller.SendAsync("Message", new { type = "error", text = "Oda sahibi hazır butonunu kullanamaz!" });
                return;
            }

            // Oyun başladıysa hazır durumu değiştirilemez
            if (room.IsStarted)
            {
                return;
            }

            player.IsReady = !player.IsReady;

            await UpdateLobbyStatus(roomCode);
        }

        public async Task StartGame(string roomCode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;

            // Sadece oda sahibi oyunu başlatabilir
            if (Context.ConnectionId != room.OwnerId)
            {
                await Clients.Caller.SendAsync("Message", new { type = "error", text = "Sadece oda sahibi oyunu başlatabilir!" });
                return;
            }

            // En az 2 oyuncu olmalı
            if (room.Players.Count < 2)
            {
                await Clients.Caller.SendAsync("Message", new { type = "error", text = "Oyunu başlatmak için en az 2 oyuncu olmalı!" });
                return;
            }

            room.IsStarted = true;
            room.CurrentRound = 1;
            room.TurnIndex = 0;
            room.IsGameFinished = false;

            if (room.GameMode == GameMode.GarticPhone)
            {
                // Gartic Phone modu: Oyunculardan kelime iste
                await Clients.Group(roomCode).SendAsync("GameStarted", new
                {
                    gameMode = "GarticPhone",
                    totalPlayers = room.Players.Count
                });
                
                await Clients.Group(roomCode).SendAsync("EnterYourWord");
            }
            else
            {
                // Klasik mod
                var playerIds = room.Players.Keys.ToList();
                room.CurrentDrawerId = playerIds[0];

                await Clients.Group(roomCode).SendAsync("GameStarted", new
                {
                    gameMode = "Classic",
                    totalRounds = room.TotalRounds,
                    currentRound = room.CurrentRound
                });
                await StartNewRound(roomCode);
            }
        }

        private async Task UpdateLobbyStatus(string roomCode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;

            var playersInfo = room.Players.Values.Select(p => new
            {
                connectionId = p.ConnectionId,
                name = p.Name,
                score = p.Score,
                isReady = p.IsReady,
                isOwner = p.ConnectionId == room.OwnerId
            }).ToList();

            await Clients.Group(roomCode).SendAsync("LobbyUpdate", new
            {
                players = playersInfo,
                isStarted = room.IsStarted
            });
        }

        public async Task StartNewRound(string roomCode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;

            // Oyun başlamadıysa tur başlatma
            if (!room.IsStarted) return;

            var random = new Random();
            room.CurrentWord = _words[random.Next(_words.Length)];
            room.RoundStartTime = DateTime.UtcNow;
            room.HasGuessed.Clear();

            await Clients.Group(roomCode).SendAsync("NewRound", new
            {
                drawer = room.Players[room.CurrentDrawerId].Name,
                drawerId = room.CurrentDrawerId,
                currentRound = room.CurrentRound,
                totalRounds = room.TotalRounds,
                turnIndex = room.TurnIndex + 1,
                totalTurns = room.Players.Count
            });

            await Clients.Client(room.CurrentDrawerId).SendAsync("YourTurnToDraw", room.CurrentWord);
        }

        public async Task SendDrawing(string roomCode, DrawingData data)
        {
            await Clients.OthersInGroup(roomCode).SendAsync("ReceiveDrawing", data);
        }

        public async Task ClearCanvas(string roomCode)
        {
            await Clients.OthersInGroup(roomCode).SendAsync("ClearCanvas");
        }

        public async Task SendGuess(string roomCode, string guess)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;
            if (!_players.TryGetValue(Context.ConnectionId, out var player)) return;

            // Oyun başlamadıysa tahmin yapılamaz
            if (!room.IsStarted)
            {
                return;
            }

            if (Context.ConnectionId == room.CurrentDrawerId)
            {
                await Clients.Caller.SendAsync("Message", new { type = "error", text = "Çizen kişi tahmin yapamaz!" });
                return;
            }

            if (room.HasGuessed.Contains(Context.ConnectionId))
            {
                await Clients.Caller.SendAsync("Message", new { type = "error", text = "Zaten doğru tahmin yaptınız!" });
                return;
            }

            var isCorrect = guess.Trim().ToLower() == room.CurrentWord.ToLower();

            if (isCorrect)
            {
                var elapsedSeconds = (DateTime.UtcNow - room.RoundStartTime).TotalSeconds;
                var points = Math.Max(10, 100 - (int)(elapsedSeconds * 2));
                player.Score += points;
                room.HasGuessed.Add(Context.ConnectionId);

                await Clients.Group(roomCode).SendAsync("CorrectGuess", new
                {
                    playerId = Context.ConnectionId,
                    playerName = player.Name,
                    points = points,
                    score = player.Score
                });

                if (room.HasGuessed.Count == room.Players.Count - 1)
                {
                    await EndRound(roomCode);
                }
            }
            else
            {
                await Clients.Group(roomCode).SendAsync("Message", new
                {
                    type = "guess",
                    playerName = player.Name,
                    text = guess
                });
            }
        }

        private async Task EndRound(string roomCode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;

            await Clients.Group(roomCode).SendAsync("RoundEnded", new
            {
                word = room.CurrentWord,
                scores = room.Players.Values.Select(p => new { name = p.Name, score = p.Score }).ToList()
            });

            await Task.Delay(5000);

            var playerIds = room.Players.Keys.ToList();
            room.TurnIndex++;

            // Eğer tüm oyuncular çizdiyse, yeni tura geç
            if (room.TurnIndex >= playerIds.Count)
            {
                room.TurnIndex = 0;
                room.CurrentRound++;

                // Eğer tüm turlar bittiyse, oyunu bitir
                if (room.CurrentRound > room.TotalRounds)
                {
                    await EndGame(roomCode);
                    return;
                }
            }

            // Sıradaki oyuncuyu belirle
            room.CurrentDrawerId = playerIds[room.TurnIndex];

            await StartNewRound(roomCode);
        }

        private async Task EndGame(string roomCode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;

            room.IsGameFinished = true;

            // Kazananı belirle
            var sortedPlayers = room.Players.Values
                .OrderByDescending(p => p.Score)
                .ToList();

            var winner = sortedPlayers.First();

            await Clients.Group(roomCode).SendAsync("GameFinished", new
            {
                winner = new { name = winner.Name, score = winner.Score },
                finalScores = sortedPlayers.Select(p => new { name = p.Name, score = p.Score }).ToList()
            });
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (_players.TryRemove(Context.ConnectionId, out var player))
            {
                foreach (var room in _rooms.Values)
                {
                    if (room.Players.TryRemove(Context.ConnectionId, out _))
                    {
                        await Clients.Group(room.RoomCode).SendAsync("PlayerLeft", player);

                        if (room.Players.Count == 0)
                        {
                            _rooms.TryRemove(room.RoomCode, out _);
                        }
                        else if (room.CurrentDrawerId == Context.ConnectionId && room.IsStarted)
                        {
                            var nextPlayer = room.Players.Keys.First();
                            room.CurrentDrawerId = nextPlayer;
                            await StartNewRound(room.RoomCode);
                        }
                        else if (Context.ConnectionId == room.OwnerId && room.Players.Count > 0)
                        {
                            // Oda sahibi ayrıldıysa yeni oda sahibi ata
                            room.OwnerId = room.Players.Keys.First();
                            await UpdateLobbyStatus(room.RoomCode);
                        }
                    }
                }
            }

            await base.OnDisconnectedAsync(exception);
        }
    }
}


