# 🎨 Draw & Guess (Çizim ve Tahmin Etme) Oyunu

ASP.NET Core SignalR kullanılarak geliştirilmiş gerçek zamanlı, çok oyunculu (multiplayer) bir kelime çizme ve tahmin etme (Gartic Phone benzeri) oyunudur.

## 🚀 Kullanılan Teknolojiler

### 💻 Backend
- **C# / .NET 9.0:** Projenin ana çatısı (ASP.NET Core Web API).
- **SignalR:** Gerçek zamanlı (real-time) çift yönlü iletişim, anlık veri akışı (Çizim aktarımı, lobiler, mesajlaşma vb.).
- **Entity Framework Core (EF Core):** Veritabanı işlemleri (Code-First yaklaşımı).
- **SQLite:** Temel veritabanı.
- **JWT (JSON Web Token):** Kullanıcı giriş-çıkışları ve yetkilendirme (Authentication/Authorization) işlemleri.
- **BCrypt:** Kullanıcı şifrelerinin güvenli bir şekilde şifrelenmesi (hashing).

### 🎨 Frontend
- **HTML5 Canvas:** Kullanıcıların tarayıcı üzerinden çizim yapabilmesi için.
- **Vanilla JavaScript:** Framework'süz saf JS. Frontend mantığı ve DOM manipülasyonu.
- **SignalR Client (JS):** Backend'deki SignalR hub'ları ile iletişim kurmak.
- **Vanilla CSS:** Özel (custom) sayfa tasarımları ve stillendirme.
- **Responsive Tasarım:** Dinamik arayüz elementleri.

## 🎮 Özellikler
- **Gerçek Zamanlı Çizim:** Ekrana çizilen çizgiler, renk ve kalınlık eşzamanlı olarak odadaki herkesle anlık senkronize olur.
- **Farklı Oyun Modları:** Klasik Mod (Biri çizer diğerleri tahmin eder) ve Gartic Phone Modu (Zincirleme çizim ve tahmin).
- **Gelişmiş Lobi ve Odalar:** Birden çok oda (Room) desteği. İsteyenler arkadaşlarına "Oda Kodu" yollayarak gizli oturum oluşturabilir.
- **Arkadaş - Sohbet Sistemi:** Kullanıcılar birbirlerini ekleyebilir, çevrimiçi/çevrimdışı durumlarını görebilir ve kendi aralarında/gruplarda anlık mesajlaşabilirler.
- **Oyun İçi Renk / Fırça Araçları:** Fırça kalınlığı ayarı, renk paleti ve tamamen temizleme opsiyonu.
