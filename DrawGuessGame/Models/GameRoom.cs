using System.Collections.Concurrent;

namespace DrawGuessGame.Models
{
    public class GameRoom
    {
        public string RoomCode { get; set; } = string.Empty;
        public ConcurrentDictionary<string, Player> Players { get; set; } = new();
        public string OwnerId { get; set; } = string.Empty;
        public bool IsStarted { get; set; } = false;
        public HashSet<string> ReadyPlayers { get; set; } = new();
        public string CurrentDrawerId { get; set; } = string.Empty;
        public string CurrentWord { get; set; } = string.Empty;
        public DateTime RoundStartTime { get; set; }
        public HashSet<string> HasGuessed { get; set; } = new();
        
        // Oyun sistemi
        public GameMode GameMode { get; set; } = GameMode.Classic;
        public int TotalRounds { get; set; } = 3;
        public int CurrentRound { get; set; } = 0;
        public int TurnIndex { get; set; } = 0;
        public bool IsGameFinished { get; set; } = false;
        
        // Gartic Phone modu için
        public ConcurrentDictionary<string, ChainItem> Chains { get; set; } = new();
        public int ChainStep { get; set; } = 0;
        public HashSet<string> CompletedPlayers { get; set; } = new();
    }

    public enum GameMode
    {
        Classic,     // Normal mod: Bir çizer, diğerleri tahmin eder
        GarticPhone  // Zincir mod: Kelime yaz → Çiz → Tahmin et → Çiz...
    }

    public class ChainItem
    {
        public string ChainId { get; set; } = string.Empty;
        public List<ChainStep> Steps { get; set; } = new();
        public string CurrentPlayerId { get; set; } = string.Empty;
    }

    public class ChainStep
    {
        public string PlayerId { get; set; } = string.Empty;
        public string PlayerName { get; set; } = string.Empty;
        public ChainStepType Type { get; set; }
        public string Content { get; set; } = string.Empty; // Kelime veya çizim base64
    }

    public enum ChainStepType
    {
        Word,
        Drawing
    }

    public class Player
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Score { get; set; }
        public bool IsReady { get; set; } = false;
    }

    public class DrawingData
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double PrevX { get; set; }
        public double PrevY { get; set; }
        public string Color { get; set; } = "#000000";
        public int Size { get; set; } = 2;
        public string Type { get; set; } = "draw";
    }
}


