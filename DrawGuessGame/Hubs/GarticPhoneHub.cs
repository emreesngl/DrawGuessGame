using Microsoft.AspNetCore.SignalR;
using DrawGuessGame.Models;
using System.Collections.Concurrent;

namespace DrawGuessGame.Hubs
{
    public partial class DrawingHub
    {
        public async Task SetGameMode(string roomCode, string mode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;
            
            // Sadece oda sahibi değiştirebilir
            if (Context.ConnectionId != room.OwnerId) return;
            
            // Oyun başlamadıysa değiştir
            if (!room.IsStarted)
            {
                room.GameMode = mode == "GarticPhone" ? GameMode.GarticPhone : GameMode.Classic;
                await Clients.Group(roomCode).SendAsync("GameModeChanged", mode);
            }
        }

        // Gartic Phone: Oyuncu kelime gönderir
        public async Task SubmitWord(string roomCode, string word)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;
            if (!_players.TryGetValue(Context.ConnectionId, out var player)) return;
            
            if (room.GameMode != GameMode.GarticPhone) return;
            
            // Bu oyuncunun chain'ini oluştur
            var chainId = Context.ConnectionId;
            var chain = new ChainItem
            {
                ChainId = chainId,
                Steps = new List<ChainStep>
                {
                    new ChainStep
                    {
                        PlayerId = Context.ConnectionId,
                        PlayerName = player.Name,
                        Type = ChainStepType.Word,
                        Content = word
                    }
                }
            };
            
            room.Chains[chainId] = chain;
            room.CompletedPlayers.Add(Context.ConnectionId);
            
            await Clients.Caller.SendAsync("WordSubmitted");
            
            // Progress'i sadece caller'a gönder
            await Clients.Caller.SendAsync("YourProgressUpdate", new
            {
                completed = room.CompletedPlayers.Count,
                total = room.Players.Count
            });
            
            // Herkes kelime girdiyse, zinciri başlat
            if (room.CompletedPlayers.Count == room.Players.Count)
            {
                await StartGarticPhoneChain(roomCode);
            }
        }

        // Gartic Phone: Çizim gönder
        public async Task SubmitDrawing(string roomCode, string chainId, string drawingData)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;
            if (!_players.TryGetValue(Context.ConnectionId, out var player)) return;
            if (!room.Chains.TryGetValue(chainId, out var chain)) return;
            
            // Çizimi chain'e ekle
            chain.Steps.Add(new ChainStep
            {
                PlayerId = Context.ConnectionId,
                PlayerName = player.Name,
                Type = ChainStepType.Drawing,
                Content = drawingData
            });
            
            room.CompletedPlayers.Add(Context.ConnectionId);
            
            await Clients.Caller.SendAsync("DrawingSubmitted");
            
            // Progress'i sadece caller'a gönder
            await Clients.Caller.SendAsync("YourProgressUpdate", new
            {
                completed = room.CompletedPlayers.Count,
                total = room.Players.Count
            });
            
            // Herkes tamamladıysa, sonraki adıma geç
            if (room.CompletedPlayers.Count == room.Players.Count)
            {
                room.ChainStep++;
                await ContinueGarticPhoneChain(roomCode);
            }
        }

        // Gartic Phone: Tahmin gönder
        public async Task SubmitGuessWord(string roomCode, string chainId, string guessWord)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;
            if (!_players.TryGetValue(Context.ConnectionId, out var player)) return;
            if (!room.Chains.TryGetValue(chainId, out var chain)) return;
            
            // Tahmini chain'e ekle
            chain.Steps.Add(new ChainStep
            {
                PlayerId = Context.ConnectionId,
                PlayerName = player.Name,
                Type = ChainStepType.Word,
                Content = guessWord
            });
            
            room.CompletedPlayers.Add(Context.ConnectionId);
            
            await Clients.Caller.SendAsync("GuessSubmitted");
            
            // Progress'i sadece caller'a gönder
            await Clients.Caller.SendAsync("YourProgressUpdate", new
            {
                completed = room.CompletedPlayers.Count,
                total = room.Players.Count
            });
            
            // Herkes tamamladıysa, sonraki adıma geç
            if (room.CompletedPlayers.Count == room.Players.Count)
            {
                room.ChainStep++;
                await ContinueGarticPhoneChain(roomCode);
            }
        }

        private async Task StartGarticPhoneChain(string roomCode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;
            
            var playerIds = room.Players.Keys.ToList();
            room.CompletedPlayers.Clear();
            room.ChainStep = 1;
            
            // Her chain'i rastgele bir sonraki oyuncuya ata
            var assignedPlayers = new HashSet<string>();
            var random = new Random();
            
            // Debug: Kaç chain var?
            Console.WriteLine($"[Gartic Phone] {room.Chains.Count} chain başlatılıyor...");
            
            foreach (var chainId in room.Chains.Keys)
            {
                var chain = room.Chains[chainId];
                var originalPlayer = chainId;
                
                // Kendisi hariç rastgele birini seç
                var availablePlayers = playerIds.Where(p => p != originalPlayer && !assignedPlayers.Contains(p)).ToList();
                
                if (availablePlayers.Count == 0)
                {
                    availablePlayers = playerIds.Where(p => p != originalPlayer).ToList();
                }
                
                var nextPlayer = availablePlayers[random.Next(availablePlayers.Count)];
                chain.CurrentPlayerId = nextPlayer;
                assignedPlayers.Add(nextPlayer);
                
                // Debug log
                var playerName = room.Players[nextPlayer].Name;
                Console.WriteLine($"[Gartic Phone] Chain {chainId} → {playerName} (kelime: {chain.Steps.Last().Content})");
                
                // Oyuncuya çizim görevini gönder
                var lastWord = chain.Steps.Last().Content;
                await Clients.Client(nextPlayer).SendAsync("DrawThisWord", new
                {
                    chainId = chainId,
                    word = lastWord,
                    step = room.ChainStep,
                    totalSteps = playerIds.Count
                });
            }
            
            Console.WriteLine($"[Gartic Phone] Tüm çizim görevleri gönderildi!");
        }

        private async Task ContinueGarticPhoneChain(string roomCode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;
            
            var playerIds = room.Players.Keys.ToList();
            
            // Tüm adımlar tamamlandıysa oyunu bitir
            if (room.ChainStep >= playerIds.Count)
            {
                await ShowGarticPhoneResults(roomCode);
                return;
            }
            
            room.CompletedPlayers.Clear();
            
            // Her chain'i yeni bir oyuncuya ata
            var assignedPlayers = new HashSet<string>();
            var random = new Random();
            
            var lastStepType = room.Chains.First().Value.Steps.Last().Type;
            var nextStepType = lastStepType == ChainStepType.Word ? ChainStepType.Drawing : ChainStepType.Word;
            
            foreach (var chainId in room.Chains.Keys)
            {
                var chain = room.Chains[chainId];
                var previousPlayer = chain.CurrentPlayerId;
                
                // Daha önce bu chain'e katılmamış birini seç
                var participatedPlayers = chain.Steps.Select(s => s.PlayerId).ToHashSet();
                var availablePlayers = playerIds.Where(p => !participatedPlayers.Contains(p) && !assignedPlayers.Contains(p)).ToList();
                
                if (availablePlayers.Count == 0)
                {
                    availablePlayers = playerIds.Where(p => !assignedPlayers.Contains(p)).ToList();
                }
                
                if (availablePlayers.Count == 0)
                {
                    availablePlayers = playerIds;
                }
                
                var nextPlayer = availablePlayers[random.Next(availablePlayers.Count)];
                chain.CurrentPlayerId = nextPlayer;
                assignedPlayers.Add(nextPlayer);
                
                var lastStep = chain.Steps.Last();
                
                if (nextStepType == ChainStepType.Drawing)
                {
                    // Kelime ver, çiz
                    await Clients.Client(nextPlayer).SendAsync("DrawThisWord", new
                    {
                        chainId = chainId,
                        word = lastStep.Content,
                        step = room.ChainStep + 1,
                        totalSteps = playerIds.Count
                    });
                }
                else
                {
                    // Çizim ver, tahmin et
                    await Clients.Client(nextPlayer).SendAsync("GuessThisDrawing", new
                    {
                        chainId = chainId,
                        drawing = lastStep.Content,
                        step = room.ChainStep + 1,
                        totalSteps = playerIds.Count
                    });
                }
            }
        }

        private async Task ShowGarticPhoneResults(string roomCode)
        {
            if (!_rooms.TryGetValue(roomCode, out var room)) return;
            
            // Tüm chain'leri gönder
            var results = room.Chains.Values.Select(chain => new
            {
                chainId = chain.ChainId,
                steps = chain.Steps.Select(s => new
                {
                    playerName = s.PlayerName,
                    type = s.Type.ToString(),
                    content = s.Content
                }).ToList()
            }).ToList();
            
            await Clients.Group(roomCode).SendAsync("GarticPhoneResults", results);
        }
    }
}

