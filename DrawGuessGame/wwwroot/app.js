// Global değişkenler
let currentUser = null;
let authToken = null;
let chatConnection = null;
let gameConnection = null;
let currentChatFriendId = null;
let currentRoom = null;
let isDrawing = false;
let canvas = null;
let ctx = null;
let currentColor = '#000000';
let currentSize = 3;
let isMyTurn = false;
let inviteCooldowns = {}; // Kullanıcı ID'sine göre cooldown

const API_BASE = '';
const screens = {
    auth: document.getElementById('authScreen'),
    menu: document.getElementById('menuScreen'),
    friends: document.getElementById('friendsScreen'),
    chat: document.getElementById('chatScreen'),
    game: document.getElementById('gameScreen')
};

// ==== AUTH İŞLEMLERİ ====
document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
});

document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
});

document.getElementById('registerBtn').addEventListener('click', async () => {
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!username || !email || !password) {
        alert('Tüm alanları doldurun!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showScreen('menu');
            initializeChatConnection();
        } else {
            alert(data.message || 'Kayıt başarısız!');
        }
    } catch (error) {
        console.error('Register error:', error);
        alert('Kayıt sırasında hata oluştu!');
    }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
    const usernameOrEmail = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!usernameOrEmail || !password) {
        alert('Tüm alanları doldurun!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernameOrEmail, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showScreen('menu');
            initializeChatConnection();
        } else {
            alert(data.message || 'Giriş başarısız!');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Giriş sırasında hata oluştu!');
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if (chatConnection) {
        chatConnection.stop();
    }
    if (gameConnection) {
        gameConnection.stop();
    }
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showScreen('auth');
});

// ==== CHAT HUB BAĞLANTISI ====
async function initializeChatConnection() {
    console.log('🔌 ChatHub bağlantısı başlatılıyor...', {
        username: currentUser.username,
        userId: currentUser.id,
        hasToken: !!authToken
    });
    
    document.getElementById('currentUsername').textContent = currentUser.username;

    chatConnection = new signalR.HubConnectionBuilder()
        .withUrl(`/chatHub?access_token=${authToken}`)
        .withAutomaticReconnect()
        .build();

    chatConnection.on("FriendOnline", (friendId, friendUsername) => {
        console.log(`${friendUsername} online oldu`);
        updateFriendOnlineStatus(friendId, true);
    });

    chatConnection.on("FriendOffline", (friendId, friendUsername) => {
        console.log(`${friendUsername} offline oldu`);
        updateFriendOnlineStatus(friendId, false);
    });

    chatConnection.on("ReceivePrivateMessage", (message) => {
        console.log('📩 Yeni mesaj geldi:', message);
        displayChatMessage(message);
    });

    chatConnection.on("UserTyping", (userId) => {
        console.log(`User ${userId} typing...`);
    });

    chatConnection.on("UserStoppedTyping", (userId) => {
        console.log(`User ${userId} stopped typing`);
    });

    chatConnection.on("GameInviteReceived", (invite) => {
        showInviteNotification(invite.senderName, invite.roomCode);
    });

    chatConnection.on("UnreadMessagesCount", (count) => {
        console.log(`📬 ${count} okunmamış mesajınız var!`);
        
        // Son gösterilen bildirim sayısını kontrol et
        const lastNotifiedCount = parseInt(localStorage.getItem('lastUnreadCount') || '0');
        
        // Sadece mesaj sayısı artmışsa veya ilk kez bildirim varsa göster
        if (count > 0 && count > lastNotifiedCount) {
            showSuccessMessage(`📬 ${count} yeni mesajınız var!`);
            localStorage.setItem('lastUnreadCount', count.toString());
        }
        
        // Mesaj yoksa sayacı sıfırla
        if (count === 0) {
            localStorage.removeItem('lastUnreadCount');
        }
    });

    chatConnection.on("ReceiveGroupMessage", (message) => {
        console.log('📩 Grup mesajı geldi:', message);
        displayGroupMessage(message);
    });

    try {
        await chatConnection.start();
        console.log("✅ ChatHub'a başarıyla bağlandı! ConnectionId:", chatConnection.connectionId);
    } catch (err) {
        console.error("❌ ChatHub bağlantı hatası:", err);
        alert("Chat sistemi bağlanamadı! Lütfen sayfayı yenileyin.");
    }
}

// ==== ARKADAŞ İŞLEMLERİ ====
document.getElementById('showFriendsBtn').addEventListener('click', () => {
    showScreen('friends');
    loadFriends();
});

document.getElementById('backToMenuFromFriends').addEventListener('click', () => {
    showScreen('menu');
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        document.getElementById(tabId).classList.add('active');
        
        if (tabId === 'myFriends') loadFriends();
        if (tabId === 'requests') loadFriendRequests();
    });
});

document.getElementById('searchBtn').addEventListener('click', async () => {
    const username = document.getElementById('searchUsername').value.trim();
    if (!username) return;

    try {
        const response = await fetch(`${API_BASE}/api/friends/search/${username}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const users = await response.json();
        const resultsDiv = document.getElementById('searchResults');
        
        resultsDiv.innerHTML = users.map(user => `
            <div class="friend-item">
                <div class="friend-info">
                    <span class="friend-name">${user.username}</span>
                </div>
                <div class="friend-actions">
                    <button class="btn btn-primary btn-small" onclick="sendFriendRequest(${user.id})">
                        Arkadaş Ekle
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Search error:', error);
    }
});

async function loadFriends() {
    try {
        const response = await fetch(`${API_BASE}/api/friends`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const friends = await response.json();
        const listDiv = document.getElementById('friendsList');
        
        listDiv.innerHTML = friends.length ? friends.map(friend => `
            <div class="friend-item" data-friend-id="${friend.id}">
                <div class="friend-info">
                    <span class="${friend.isOnline ? 'online-indicator' : 'offline-indicator'}"></span>
                    <span class="friend-name">${friend.username}</span>
                </div>
                <div class="friend-actions">
                    <button class="btn btn-danger btn-small" onclick="removeFriend(${friend.id})">Sil</button>
                </div>
            </div>
        `).join('') : '<p style="text-align:center;color:#666;">Henüz arkadaşınız yok</p>';
    } catch (error) {
        console.error('Load friends error:', error);
    }
}

async function loadFriendRequests() {
    try {
        const response = await fetch(`${API_BASE}/api/friends/requests`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const requests = await response.json();
        const listDiv = document.getElementById('requestsList');
        
        listDiv.innerHTML = requests.length ? requests.map(req => `
            <div class="friend-item">
                <div class="friend-info">
                    <span class="friend-name">${req.username}</span>
                </div>
                <div class="friend-actions">
                    <button class="btn btn-primary btn-small" onclick="acceptFriendRequest(${req.id})">Kabul Et</button>
                    <button class="btn btn-danger btn-small" onclick="declineFriendRequest(${req.id})">Reddet</button>
                </div>
            </div>
        `).join('') : '<p style="text-align:center;color:#666;">Arkadaşlık isteği yok</p>';
    } catch (error) {
        console.error('Load requests error:', error);
    }
}

async function sendFriendRequest(friendId) {
    try {
        const response = await fetch(`${API_BASE}/api/friends/send/${friendId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        alert(data.message);
    } catch (error) {
        console.error('Send request error:', error);
    }
}

async function acceptFriendRequest(friendId) {
    try {
        const response = await fetch(`${API_BASE}/api/friends/accept/${friendId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        alert(data.message);
        loadFriendRequests();
        loadFriends();
    } catch (error) {
        console.error('Accept request error:', error);
    }
}

async function declineFriendRequest(friendId) {
    try {
        const response = await fetch(`${API_BASE}/api/friends/decline/${friendId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        alert(data.message);
        loadFriendRequests();
    } catch (error) {
        console.error('Decline request error:', error);
    }
}

async function removeFriend(friendId) {
    if (!confirm('Bu arkadaşı silmek istediğinizden emin misiniz?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/friends/${friendId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        alert(data.message);
        loadFriends();
    } catch (error) {
        console.error('Remove friend error:', error);
    }
}

function updateFriendOnlineStatus(friendId, isOnline) {
    const friendItem = document.querySelector(`[data-friend-id="${friendId}"]`);
    if (friendItem) {
        const indicator = friendItem.querySelector('.online-indicator, .offline-indicator');
        if (indicator) {
            indicator.className = isOnline ? 'online-indicator' : 'offline-indicator';
        }
    }
}

// ==== CHAT İŞLEMLERİ ====
document.getElementById('showChatBtn').addEventListener('click', async () => {
    console.log('💬 Chat ekranına geçiliyor...');
    showScreen('chat');
    await loadChatFriends();
    await loadGroups();
    setupChatTabs();
    console.log('✅ Chat arkadaş listesi yüklendi');
});

document.getElementById('backToMenuFromChat').addEventListener('click', () => {
    showScreen('menu');
});

// Chat tab değiştirme
let chatTabsInitialized = false;
function setupChatTabs() {
    if (chatTabsInitialized) return; // Sadece bir kez çalıştır
    
    const tabBtns = document.querySelectorAll('.chat-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.style.background = '#f8f9fa';
                b.style.color = '#333';
            });
            btn.style.background = '#667eea';
            btn.style.color = 'white';
            
            const tab = btn.dataset.tab;
            document.getElementById('chatFriendsTab').style.display = tab === 'friends' ? 'block' : 'none';
            document.getElementById('chatGroupsTab').style.display = tab === 'groups' ? 'block' : 'none';
        });
    });
    chatTabsInitialized = true;
}

// ==== GRUP SOHBET ====
let currentGroupId = null;
let currentChatType = 'private'; // 'private' veya 'group'

document.getElementById('createGroupBtn').addEventListener('click', showCreateGroupModal);

async function showCreateGroupModal() {
    const groupName = prompt('Grup adını girin:');
    if (!groupName) return;
    
    // Arkadaşlardan seç
    try {
        const response = await fetch(`${API_BASE}/api/friends`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const friends = await response.json();
        
        if (friends.length === 0) {
            alert('Gruba eklemek için arkadaşınız yok!');
            return;
        }
        
        const selectedIds = [];
        let html = '<div style="max-height: 300px; overflow-y: auto;">';
        friends.forEach(f => {
            html += `<label style="display: block; margin: 10px 0;"><input type="checkbox" value="${f.id}"> ${f.username}</label>`;
        });
        html += '</div>';
        
        const container = document.createElement('div');
        container.innerHTML = html;
        
        // Basit modal göster
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); z-index: 10000;
            display: flex; justify-content: center; align-items: center;
        `;
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%;">
                <h3 style="color: #667eea; margin-bottom: 20px;">Gruba Üye Ekle</h3>
                <div id="friendCheckboxes">${html}</div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-primary" id="confirmCreateGroup" style="flex: 1;">Oluştur</button>
                    <button class="btn btn-secondary" id="cancelCreateGroup" style="flex: 1;">İptal</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('confirmCreateGroup').addEventListener('click', async () => {
            const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
            const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
            
            const response = await fetch(`${API_BASE}/api/groups/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: groupName, memberIds })
            });
            
            if (response.ok) {
                alert('Grup oluşturuldu!');
                modal.remove();
                loadGroups();
            }
        });
        
        document.getElementById('cancelCreateGroup').addEventListener('click', () => {
            modal.remove();
        });
        
    } catch (error) {
        console.error('Create group error:', error);
    }
}

async function loadGroups() {
    try {
        const response = await fetch(`${API_BASE}/api/groups`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const groups = await response.json();
        const listDiv = document.getElementById('groupsList');
        
        if (groups.length === 0) {
            listDiv.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Henüz grubunuz yok</p>';
            return;
        }
        
        listDiv.innerHTML = groups.map(group => `
            <div class="chat-friend-item" data-group-id="${group.id}" onclick="selectGroup(${group.id}, '${group.name}')">
                <span>👥</span>
                <span>${group.name} (${group.memberCount})</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load groups error:', error);
    }
}

window.selectGroup = async function(groupId, groupName) {
    console.log('🎯 Grup seçiliyor:', groupId, groupName);
    currentGroupId = parseInt(groupId);
    currentChatFriendId = null;
    currentChatType = 'group';
    console.log('✅ currentGroupId:', currentGroupId, 'currentChatFriendId:', currentChatFriendId);
    
    document.getElementById('chatWithUsername').textContent = '👥 ' + groupName;
    
    const chatInputArea = document.getElementById('chatInputArea');
    chatInputArea.style.display = 'flex';
    
    document.querySelectorAll('.chat-friend-item').forEach(item => item.classList.remove('active'));
    const groupElement = document.querySelector(`[data-group-id="${groupId}"]`);
    if (groupElement) groupElement.classList.add('active');
    
    try {
        const messages = await chatConnection.invoke("GetGroupChatHistory", groupId, 0, 50);
        
        // Grup mesajları okundu, bildirim sayacını sıfırla
        if (messages.length > 0) {
            localStorage.removeItem('lastUnreadCount');
        }
        
        const container = document.getElementById('chatMessagesContainer');
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #999;">
                    <div style="text-align: center;">
                        <div style="font-size: 3em; margin-bottom: 10px;">👋</div>
                        <p>Henüz mesaj yok. İlk mesajı gönderin!</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = messages.map(msg => {
                const isSent = msg.senderId === currentUser.id;
                return `
                    <div class="chat-message-item ${isSent ? 'sent' : 'received'}">
                        ${!isSent ? `<div style="font-size: 0.8em; color: #667eea; margin-bottom: 3px; font-weight: bold;">${msg.senderUsername}</div>` : ''}
                        <div class="chat-message-bubble">${msg.message}</div>
                        <div class="chat-message-time">${new Date(msg.sentAt).toLocaleTimeString('tr-TR')}</div>
                    </div>
                `;
            }).join('');
        }
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Load group history error:', error);
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    if (!message) return;

    console.log('📨 sendChatMessage çağrıldı:', {
        currentGroupId: currentGroupId,
        currentChatFriendId: currentChatFriendId,
        currentChatType: currentChatType,
        message: message
    });

    // Önce grup kontrolü yap
    if (currentGroupId) {
        console.log('📤 Grup mesajı gönderiliyor...');
        try {
            await chatConnection.invoke("SendGroupMessage", currentGroupId, message);
            console.log('✅ Grup mesajı gönderildi');
            input.value = '';
        } catch (error) {
            console.error('❌ Send group message error:', error);
            alert('Grup mesajı gönderilemedi: ' + error);
        }
    } 
    // Sonra arkadaş kontrolü
    else if (currentChatFriendId) {
        console.log('📤 Özel mesaj gönderiliyor...');
        try {
            await chatConnection.invoke("SendPrivateMessage", currentChatFriendId, message);
            console.log('✅ Özel mesaj gönderildi');
            input.value = '';
        } catch (error) {
            console.error('❌ Send message error:', error);
            alert('Mesaj gönderilemedi: ' + error);
        }
    } 
    else {
        console.error('❌ Ne grup ne de arkadaş seçili!');
        alert('Önce bir arkadaş veya grup seçin!');
    }
}

function displayGroupMessage(message) {
    if (currentChatType !== 'group' || currentGroupId !== message.groupId) return;
    
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;
    
    const isSent = message.senderId === currentUser.id;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message-item ${isSent ? 'sent' : 'received'}`;
    msgDiv.innerHTML = `
        ${!isSent ? `<div style="font-size: 0.8em; color: #667eea; margin-bottom: 3px; font-weight: bold;">${message.senderUsername}</div>` : ''}
        <div class="chat-message-bubble">${message.message}</div>
        <div class="chat-message-time">${new Date(message.sentAt).toLocaleTimeString('tr-TR')}</div>
    `;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// Event listener'ları sadece bir kez ekle
let chatMessageListenersAdded = false;
if (!chatMessageListenersAdded) {
    document.getElementById('sendMessageBtn').addEventListener('click', () => {
        console.log('🖱️ Gönder butonuna tıklandı');
        sendChatMessage();
    });
    
    document.getElementById('chatMessageInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            console.log('⌨️ Enter tuşuna basıldı');
            sendChatMessage();
        }
    });
    chatMessageListenersAdded = true;
    console.log('✅ Chat mesaj event listener\'ları eklendi');
}

async function loadChatFriends() {
    console.log('👥 Chat arkadaş listesi yükleniyor...');
    try {
        const response = await fetch(`${API_BASE}/api/friends`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const friends = await response.json();
        console.log('📋 Arkadaşlar:', friends);
        
        const listDiv = document.getElementById('chatFriendsList');
        
        if (friends.length === 0) {
            listDiv.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Arkadaşınız yok</p>';
            return;
        }
        
        listDiv.innerHTML = friends.map(friend => `
            <div class="chat-friend-item" data-friend-id="${friend.id}" onclick="selectChatFriend(${friend.id}, '${friend.username}')">
                <span class="${friend.isOnline ? 'online-indicator' : 'offline-indicator'}"></span>
                <span>${friend.username}</span>
            </div>
        `).join('');
        
        console.log('✅', friends.length, 'arkadaş listelendi');
    } catch (error) {
        console.error('❌ Load chat friends error:', error);
    }
}

window.selectChatFriend = async function(friendId, friendUsername) {
    console.log('👤 Arkadaş seçildi:', {
        friendId: friendId,
        friendUsername: friendUsername,
        currentUserId: currentUser.id,
        currentUsername: currentUser.username
    });
    
    // ID'yi NUMBER olarak sakla
    currentChatFriendId = parseInt(friendId);
    currentGroupId = null;
    currentChatType = 'private';
    console.log('💾 currentChatFriendId ayarlandı:', currentChatFriendId, typeof currentChatFriendId);
    console.log('🚫 currentGroupId sıfırlandı (arkadaş seçildi)');
    
    document.getElementById('chatWithUsername').textContent = friendUsername;
    
    // Input alanını göster
    const chatInputArea = document.getElementById('chatInputArea');
    chatInputArea.style.display = 'flex';
    
    const messageInput = document.getElementById('chatMessageInput');
    
    setTimeout(() => {
        messageInput.focus();
        console.log('✅ Input focus edildi');
    }, 100);

    document.querySelectorAll('.chat-friend-item').forEach(item => item.classList.remove('active'));
    const selectedItem = document.querySelector(`[data-friend-id="${friendId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    try {
        const messages = await chatConnection.invoke("GetChatHistory", friendId, 0, 50);
        console.log('📜 Mesaj geçmişi yüklendi:', messages.length, 'mesaj');
        
        // Mesajlar okundu, bildirim sayacını sıfırla
        if (messages.length > 0) {
            localStorage.removeItem('lastUnreadCount');
        }
        
        const container = document.getElementById('chatMessagesContainer');
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #999;">
                    <div style="text-align: center;">
                        <div style="font-size: 3em; margin-bottom: 10px;">👋</div>
                        <p>Henüz mesaj yok. İlk mesajı gönderin!</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = messages.map(msg => {
                const isSent = msg.senderId === currentUser.id;
                return `
                    <div class="chat-message-item ${isSent ? 'sent' : 'received'}">
                        <div class="chat-message-bubble">${msg.message}</div>
                        <div class="chat-message-time">${new Date(msg.sentAt).toLocaleTimeString('tr-TR')}</div>
                    </div>
                `;
            }).join('');
        }
        
        container.scrollTop = container.scrollHeight;
        
        console.log('✅ Chat hazır! currentChatFriendId:', currentChatFriendId);
    } catch (error) {
        console.error('Load chat history error:', error);
    }
}

function displayChatMessage(message) {
    console.log('💬 displayChatMessage çağrıldı:', message);
    
    // ID'leri number olarak karşılaştır
    const msgSenderId = parseInt(message.senderId);
    const msgReceiverId = parseInt(message.receiverId);
    const myId = parseInt(currentUser.id);
    const chatFriendId = parseInt(currentChatFriendId);
    
    console.log('📝 ID Kontrol:', {
        currentChatFriendId: chatFriendId,
        currentUserId: myId,
        senderId: msgSenderId,
        receiverId: msgReceiverId,
        senderUsername: message.senderUsername,
        receiverUsername: message.receiverUsername
    });
    
    // Mesaj bu chat konuşmasına mı ait?
    const isThisChat = (msgSenderId === myId && msgReceiverId === chatFriendId) ||
                       (msgReceiverId === myId && msgSenderId === chatFriendId);
    
    console.log('🔍 isThisChat:', isThisChat);
    
    if (isThisChat) {
        const container = document.getElementById('chatMessagesContainer');
        if (!container) {
            console.log('❌ chatMessagesContainer bulunamadı!');
            return;
        }
        
        const isSent = msgSenderId === myId;
        console.log('📤 isSent:', isSent, '(', msgSenderId, '===', myId, ')');
        
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message-item ${isSent ? 'sent' : 'received'}`;
        msgDiv.innerHTML = `
            <div class="chat-message-bubble">${message.message}</div>
            <div class="chat-message-time">${new Date(message.sentAt).toLocaleTimeString('tr-TR')}</div>
        `;
        
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
        console.log('✅ Mesaj ekrana eklendi!', isSent ? 'SENT' : 'RECEIVED');
    } else {
        console.log('❌ Mesaj gösterilmedi - farklı chat penceresi');
        console.log('   Beklenen:', {
            'Ben → Arkadaş': myId + ' → ' + chatFriendId,
            'Arkadaş → Ben': chatFriendId + ' → ' + myId
        });
        console.log('   Gelen:', msgSenderId + ' → ' + msgReceiverId);
    }
}

// ==== OYUN İŞLEMLERİ ====
let isRoomOwner = false;
let isGameStarted = false;
let myReadyStatus = false;

document.getElementById('joinGameBtn').addEventListener('click', () => {
    const roomCode = document.getElementById('roomCode').value.trim() || generateRoomCode();
    joinGame(roomCode.toUpperCase());
});

document.getElementById('leaveGameBtn').addEventListener('click', leaveGame);
document.getElementById('leaveLobbyBtn').addEventListener('click', leaveGame);

document.getElementById('readyBtn').addEventListener('click', async () => {
    try {
        await gameConnection.invoke("ToggleReady", currentRoom);
    } catch (error) {
        console.error('Ready toggle error:', error);
    }
});

document.getElementById('startGameBtn').addEventListener('click', async () => {
    try {
        await gameConnection.invoke("StartGame", currentRoom);
    } catch (error) {
        console.error('Start game error:', error);
    }
});

function leaveGame() {
    if (gameConnection) {
        gameConnection.stop();
    }
    showScreen('menu');
}

async function joinGame(roomCode) {
    currentRoom = roomCode;

    gameConnection = new signalR.HubConnectionBuilder()
        .withUrl("/drawingHub")
        .withAutomaticReconnect()
        .build();

    gameConnection.on("RoomJoined", onRoomJoined);
    gameConnection.on("LobbyUpdate", onLobbyUpdate);
    gameConnection.on("PlayerJoined", onPlayerJoined);
    gameConnection.on("PlayerLeft", onPlayerLeft);
    gameConnection.on("GameStarted", onGameStarted);
    gameConnection.on("NewRound", onNewRound);
    gameConnection.on("YourTurnToDraw", onYourTurnToDraw);
    gameConnection.on("ReceiveDrawing", onReceiveDrawing);
    gameConnection.on("ClearCanvas", onClearCanvas);
    gameConnection.on("Message", onMessage);
    gameConnection.on("CorrectGuess", onCorrectGuess);
    gameConnection.on("RoundEnded", onRoundEnded);
    gameConnection.on("GameFinished", onGameFinished);
    
    // Gartic Phone events
    gameConnection.on("GameModeChanged", onGameModeChanged);
    gameConnection.on("EnterYourWord", onEnterYourWord);
    gameConnection.on("DrawThisWord", onDrawThisWord);
    gameConnection.on("GuessThisDrawing", onGuessThisDrawing);
    gameConnection.on("YourProgressUpdate", onYourProgressUpdate);
    gameConnection.on("WordSubmitted", onWordSubmitted);
    gameConnection.on("DrawingSubmitted", onDrawingSubmitted);
    gameConnection.on("GuessSubmitted", onGuessSubmitted);
    gameConnection.on("GarticPhoneResults", onGarticPhoneResults);

    try {
        await gameConnection.start();
        await gameConnection.invoke("JoinRoom", currentRoom, currentUser.username);
    } catch (err) {
        console.error("Game connection error:", err);
        alert("Oyuna bağlanılamadı!");
    }
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function onRoomJoined(data) {
    showScreen('game');
    isRoomOwner = data.isOwner;
    isGameStarted = data.isStarted;
    
    document.getElementById('lobbyRoomCode').textContent = data.roomCode;
    document.getElementById('currentRoomCode').textContent = data.roomCode;
    
    // Butonları göster/gizle
    if (isRoomOwner) {
        document.getElementById('startGameBtn').style.display = 'block';
        document.getElementById('readyBtn').style.display = 'none';
        // Oda sahibi mod değiştirebilir
        document.getElementById('gameModeSelector').style.display = 'block';
        setupGameModeSelector();
    } else {
        document.getElementById('startGameBtn').style.display = 'none';
        document.getElementById('readyBtn').style.display = 'block';
        // Diğer oyuncular mod değiştiremez
        document.getElementById('gameModeSelector').style.display = 'none';
    }
    
    if (isGameStarted) {
        showGamePlay();
    } else {
        showLobby();
        loadLobbyFriends();
    }
    
    updateLobbyPlayers(data.players);
}

function setupGameModeSelector() {
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mode = btn.dataset.mode;
            try {
                await gameConnection.invoke("SetGameMode", currentRoom, mode);
            } catch (error) {
                console.error('Set game mode error:', error);
            }
        });
    });
}

async function loadLobbyFriends() {
    try {
        const response = await fetch(`${API_BASE}/api/friends`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const friends = await response.json();
        const listDiv = document.getElementById('lobbyFriendsList');
        
        if (friends.length === 0) {
            listDiv.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Henüz arkadaşınız yok</p>';
            return;
        }
        
        listDiv.innerHTML = friends.map(friend => `
            <div class="lobby-friend-item ${friend.isOnline ? 'online' : 'offline'}">
                <span class="lobby-friend-name ${friend.isOnline ? 'online' : 'offline'}">${friend.username}</span>
                <button class="lobby-friend-invite" 
                        onclick="inviteFriend(${friend.id}, '${friend.username}')"
                        ${!friend.isOnline ? 'disabled' : ''}>
                    ${friend.isOnline ? 'Davet Et' : 'Offline'}
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load lobby friends error:', error);
    }
}

async function inviteFriend(friendId, friendName) {
    // Cooldown kontrolü
    if (inviteCooldowns[friendId]) {
        const remainingTime = Math.ceil((inviteCooldowns[friendId] - Date.now()) / 1000);
        if (remainingTime > 0) {
            alert(`Bu arkadaşı ${remainingTime} saniye sonra tekrar davet edebilirsiniz.`);
            return;
        }
    }

    try {
        await chatConnection.invoke("SendGameInvite", friendId, currentRoom);
        
        // Başarılı davet sonrası cooldown ayarla (3 saniye)
        inviteCooldowns[friendId] = Date.now() + 3000;
        
        // Buton durumunu güncelle
        updateInviteButtonState(friendId);
        
        // Başarı mesajı
        showSuccessMessage(`${friendName} arkadaşınıza davet gönderildi!`);
        
        // 3 saniye sonra butonu tekrar aktif et
        setTimeout(() => {
            delete inviteCooldowns[friendId];
            updateInviteButtonState(friendId);
        }, 3000);
    } catch (error) {
        console.error('Invite friend error:', error);
        alert('Davet gönderilemedi!');
    }
}

function updateInviteButtonState(friendId) {
    const button = document.querySelector(`[onclick*="inviteFriend(${friendId}"]`);
    if (!button) return;
    
    if (inviteCooldowns[friendId] && inviteCooldowns[friendId] > Date.now()) {
        const remainingTime = Math.ceil((inviteCooldowns[friendId] - Date.now()) / 1000);
        button.disabled = true;
        button.textContent = `${remainingTime}s`;
        
        // Her saniye güncelle
        const interval = setInterval(() => {
            const remaining = Math.ceil((inviteCooldowns[friendId] - Date.now()) / 1000);
            if (remaining <= 0) {
                clearInterval(interval);
                button.disabled = false;
                button.textContent = 'Davet Et';
            } else {
                button.textContent = `${remaining}s`;
            }
        }, 1000);
    } else {
        button.disabled = false;
        button.textContent = 'Davet Et';
    }
}

function showSuccessMessage(message) {
    const div = document.createElement('div');
    div.className = 'success-toast';
    div.textContent = message;
    div.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #28a745;
        color: white;
        padding: 15px 30px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 10001;
        animation: fadeInOut 3s ease-out forwards;
    `;
    document.body.appendChild(div);
    
    setTimeout(() => div.remove(), 3000);
}

function showInviteNotification(senderName, roomCode) {
    const notificationId = `invite-${Date.now()}`;
    const container = document.getElementById('inviteNotifications');
    
    const notification = document.createElement('div');
    notification.className = 'invite-notification';
    notification.id = notificationId;
    notification.innerHTML = `
        <div class="invite-header">
            <div class="invite-icon">🎮</div>
            <div class="invite-title">
                <h4>Oyun Daveti!</h4>
                <p><strong>${senderName}</strong> sizi oyuna davet etti</p>
            </div>
        </div>
        <div class="invite-room-code">
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Oda Kodu</div>
            <strong>${roomCode}</strong>
        </div>
        <div class="invite-actions">
            <button class="btn btn-success" onclick="acceptInvite('${notificationId}', '${roomCode}')">
                ✓ Katıl
            </button>
            <button class="btn btn-decline" onclick="declineInvite('${notificationId}')">
                ✗ Reddet
            </button>
        </div>
    `;
    
    container.appendChild(notification);
    
    // 15 saniye sonra otomatik kapat
    setTimeout(() => {
        removeInviteNotification(notificationId);
    }, 15000);
}

function acceptInvite(notificationId, roomCode) {
    removeInviteNotification(notificationId);
    
    // Mevcut oyun bağlantısı varsa kapat
    if (gameConnection) {
        gameConnection.stop();
    }
    
    joinGame(roomCode);
}

function declineInvite(notificationId) {
    removeInviteNotification(notificationId);
}

function removeInviteNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
        notification.classList.add('removing');
        setTimeout(() => notification.remove(), 300);
    }
}

function onLobbyUpdate(data) {
    updateLobbyPlayers(data.players);
    if (data.isStarted && !isGameStarted) {
        isGameStarted = true;
        showGamePlay();
    }
}

function updateLobbyPlayers(players) {
    const listDiv = document.getElementById('lobbyPlayersList');
    const countSpan = document.getElementById('lobbyPlayerCount');
    
    countSpan.textContent = players.length;
    
    listDiv.innerHTML = players.map(p => {
        let classes = 'lobby-player-item';
        if (p.isOwner) classes += ' owner';
        else if (p.isReady) classes += ' ready';
        
        return `
            <div class="${classes}">
                <div class="lobby-player-info">
                    <span class="lobby-player-name">${p.name}</span>
                    ${p.isOwner ? '<span class="lobby-player-badge">OWNER</span>' : ''}
                </div>
                <div>
                    ${p.isOwner ? '' : (p.isReady ? '<span class="lobby-player-status">✓ Hazır</span>' : '<span style="color:#999">Bekliyor...</span>')}
                </div>
            </div>
        `;
    }).join('');
}

function showLobby() {
    document.getElementById('lobbySection').style.display = 'flex';
    document.getElementById('gamePlaySection').style.display = 'none';
}

function showGamePlay() {
    document.getElementById('lobbySection').style.display = 'none';
    document.getElementById('gamePlaySection').style.display = 'flex';
    initializeCanvas();
}

function onGameStarted(data) {
    isGameStarted = true;
    
    if (data.gameMode === 'GarticPhone') {
        showGamePlay();
        // Gartic Phone modunda EnterYourWord eventi ayrıca gelecek, onu bekle
        console.log('Gartic Phone modu başladı, kelime bekleniyor...');
    } else {
        // Klasik mod
        showGamePlay();
        addGameChatMessage(`Oyun başladı! Toplam ${data.totalRounds} tur oynanacak. İyi eğlenceler!`, 'system');
    }
}

function onPlayerJoined(data) {
    if (isGameStarted) {
        addGameChatMessage(`${data.player.name} oyuna katıldı!`, 'system');
    }
}

function onPlayerLeft(player) {
    if (isGameStarted) {
        addGameChatMessage(`${player.name} oyundan ayrıldı.`, 'system');
    }
}

function onNewRound(data) {
    clearCanvasLocal();
    document.getElementById('gameStatus').textContent = `Tur ${data.currentRound}/${data.totalRounds} - ${data.drawer} çiziyor... (${data.turnIndex}/${data.totalTurns})`;
    document.getElementById('wordDisplay').textContent = '';
    isMyTurn = data.drawerId === gameConnection.connectionId;
    
    const tools = document.getElementById('drawingTools');
    const guessInput = document.getElementById('guessInput');
    const guessBtn = document.getElementById('guessBtn');
    
    if (isMyTurn) {
        tools.classList.remove('disabled');
        guessInput.disabled = true;
        guessBtn.disabled = true;
    } else {
        tools.classList.add('disabled');
        guessInput.disabled = false;
        guessBtn.disabled = false;
        guessInput.value = '';
    }
}

function onYourTurnToDraw(word) {
    document.getElementById('wordDisplay').textContent = `Çizilecek kelime: ${word}`;
    addGameChatMessage(`Sıra sizde! Kelimeyi çizin: ${word}`, 'system');
}

function onReceiveDrawing(data) {
    drawOnCanvas(data);
}

function onClearCanvas() {
    clearCanvasLocal();
}

function onMessage(message) {
    if (message.type === 'guess') {
        addGameChatMessage(message.text, 'guess', message.playerName);
    } else if (message.type === 'error') {
        addGameChatMessage(message.text, 'error');
    }
}

function onCorrectGuess(data) {
    addGameChatMessage(`${data.playerName} doğru tahmin etti! +${data.points} puan!`, 'correct');
}

function onRoundEnded(data) {
    document.getElementById('gameStatus').textContent = 'Tur bitti!';
    document.getElementById('wordDisplay').textContent = `Kelime: ${data.word}`;
    addGameChatMessage(`Tur sona erdi! Kelime: ${data.word}`, 'system');
    updateScores(data.scores);
}

function onGameFinished(data) {
    // Oyun bitti ekranını göster
    const gamePlaySection = document.getElementById('gamePlaySection');
    gamePlaySection.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: white; border-radius: 20px; padding: 40px;">
            <div style="text-align: center; max-width: 600px;">
                <h1 style="font-size: 3em; color: #667eea; margin-bottom: 20px;">🏆 OYUN BİTTİ! 🏆</h1>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 20px; margin: 30px 0; color: white;">
                    <h2 style="font-size: 2em; margin: 0;">KAZANAN</h2>
                    <h3 style="font-size: 3em; margin: 20px 0;">${data.winner.name}</h3>
                    <p style="font-size: 1.5em; margin: 0;">${data.winner.score} Puan</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 30px 0;">
                    <h3 style="color: #667eea; margin-bottom: 20px;">Final Sıralaması</h3>
                    ${data.finalScores.map((player, index) => `
                        <div style="display: flex; justify-content: space-between; padding: 15px; background: white; margin: 10px 0; border-radius: 10px; border-left: 5px solid ${index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#667eea'};">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <span style="font-size: 1.5em; font-weight: bold; color: #666;">${index + 1}.</span>
                                <span style="font-size: 1.2em; font-weight: bold;">${player.name}</span>
                            </div>
                            <span style="font-size: 1.3em; color: #667eea; font-weight: bold;">${player.score} 🏆</span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="display: flex; gap: 20px; justify-content: center;">
                    <button onclick="location.reload()" class="btn btn-primary" style="padding: 15px 40px; font-size: 1.2em;">
                        🔄 Yeni Oyun
                    </button>
                    <button onclick="backToMenu()" class="btn btn-secondary" style="padding: 15px 40px; font-size: 1.2em;">
                        🏠 Ana Menü
                    </button>
                </div>
            </div>
        </div>
    `;
    
    addGameChatMessage(`🏆 ${data.winner.name} KAZANDI! ${data.winner.score} puanla!`, 'system');
}

function backToMenu() {
    if (gameConnection) {
        gameConnection.stop();
    }
    location.reload();
}

// ==== GARTIC PHONE MOD EVENT HANDLERS ====
let currentChainId = null;
let currentGarticTask = null;

function onGameModeChanged(mode) {
    console.log('Oyun modu değişti:', mode);
}

function onEnterYourWord() {
    showGarticPhoneModal('word', null);
    startWordTimer(15); // 15 saniye
}

let wordTimerInterval = null;

function startWordTimer(seconds) {
    let remaining = seconds;
    
    const updateTimer = () => {
        const timerEl = document.getElementById('wordTimer');
        if (timerEl) {
            timerEl.textContent = remaining;
            
            if (remaining <= 0) {
                clearInterval(wordTimerInterval);
                // Süre bitti, rastgele kelime gönder
                const randomWords = ['kedi', 'araba', 'ev', 'güneş', 'top', 'çiçek', 'deniz'];
                const randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];
                document.getElementById('garticWordInput').value = randomWord;
                submitGarticWord();
            }
        }
        remaining--;
    };
    
    wordTimerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

function onDrawThisWord(data) {
    console.log('🎨 DrawThisWord eventi geldi:', data);
    console.log('📍 ChainId:', data.chainId);
    console.log('📝 Kelime:', data.word);
    console.log('📊 Step:', data.step, '/', data.totalSteps);
    
    currentChainId = data.chainId;
    currentGarticTask = 'draw';
    
    // Ekranı göster
    setTimeout(() => {
        showGarticPhoneModal('draw', data.word);
        startDrawTimer(30); // 30 saniye çizim süresi
    }, 100);
}

let drawTimerInterval = null;

function startDrawTimer(seconds) {
    let remaining = seconds;
    
    const updateTimer = () => {
        const timerEl = document.getElementById('drawTimer');
        if (timerEl) {
            timerEl.textContent = remaining;
            
            if (remaining <= 0) {
                clearInterval(drawTimerInterval);
                // Süre bitti, çizimi otomatik gönder
                submitGarticDrawing();
            }
        }
        remaining--;
    };
    
    drawTimerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

function onGuessThisDrawing(data) {
    console.log('🔍 GuessThisDrawing eventi geldi:', data);
    currentChainId = data.chainId;
    currentGarticTask = 'guess';
    
    setTimeout(() => {
        showGarticPhoneModal('guess', data.drawing);
        startGuessTimer(20); // 20 saniye tahmin süresi
    }, 100);
}

let guessTimerInterval = null;

function startGuessTimer(seconds) {
    let remaining = seconds;
    
    const updateTimer = () => {
        const timerEl = document.getElementById('guessTimer');
        if (timerEl) {
            timerEl.textContent = remaining;
            
            if (remaining <= 0) {
                clearInterval(guessTimerInterval);
                // Süre bitti, rastgele tahmin gönder
                const randomGuesses = ['bilmiyorum', 'fikrim yok', 'ne bu', 'anlamadım'];
                const randomGuess = randomGuesses[Math.floor(Math.random() * randomGuesses.length)];
                document.getElementById('garticGuessInput').value = randomGuess;
                submitGarticGuess();
            }
        }
        remaining--;
    };
    
    guessTimerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

function onYourProgressUpdate(data) {
    console.log('📊 Progress güncellendi:', data);
    // Sadece console'a log at, ekranı değiştirme
    // Ekran zaten showWaitingScreen() ile değişti
}

function onWordSubmitted() {
    console.log('Kelime gönderildi');
}

function onDrawingSubmitted() {
    console.log('Çizim gönderildi');
}

function onGuessSubmitted() {
    console.log('Tahmin gönderildi');
}

function onGarticPhoneResults(results) {
    console.log('🎉 Gartic Phone sonuçları geldi:', results);
    const gamePlaySection = document.getElementById('gamePlaySection');
    
    let html = `
        <div style="display: flex; justify-content: center; align-items: start; height: 100%; background: white; border-radius: 20px; padding: 40px; overflow-y: auto;">
            <div style="width: 100%; max-width: 1400px;">
                <h1 style="font-size: 2.5em; color: #667eea; text-align: center; margin-bottom: 20px;">
                    🎨 Gartic Phone - Sonuçlar 🎨
                </h1>
                <p style="text-align: center; color: #666; margin-bottom: 40px;">Kelimeler nasıl değişmiş görelim! 😄</p>
    `;
    
    results.forEach((chain, index) => {
        html += `
            <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin-bottom: 30px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="color: #667eea; margin: 0;">Zincir ${index + 1}</h3>
                    <button onclick="downloadChain(${index})" class="btn btn-primary btn-small">
                        📥 İndir
                    </button>
                </div>
                <div style="display: flex; gap: 15px; overflow-x: auto; padding: 20px 0;">
        `;
        
        chain.steps.forEach((step, stepIndex) => {
            if (step.type === 'Word') {
                html += `
                    <div style="min-width: 220px; background: white; padding: 20px; border-radius: 12px; text-align: center; border: 3px solid #667eea; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">
                        <div style="font-size: 1.8em; margin-bottom: 10px;">📝</div>
                        <div style="font-size: 1.3em; font-weight: bold; color: #667eea; margin-bottom: 10px; word-wrap: break-word;">${step.content}</div>
                        <div style="font-size: 0.9em; color: #999; font-weight: 500;">${step.playerName}</div>
                    </div>
                `;
            } else {
                html += `
                    <div class="chain-drawing-${index}-${stepIndex}" style="min-width: 220px; background: white; padding: 10px; border-radius: 12px; text-align: center; border: 3px solid #28a745; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">
                        <img src="${step.content}" style="width: 200px; height: 200px; border-radius: 8px; margin-bottom: 10px; object-fit: contain; background: #f8f9fa;" />
                        <div style="font-size: 0.9em; color: #999; font-weight: 500; margin-bottom: 5px;">${step.playerName}</div>
                        <button onclick="downloadImage('${step.content}', '${step.playerName}_cizim')" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.85em;">
                            💾 İndir
                        </button>
                    </div>
                `;
            }
            
            if (stepIndex < chain.steps.length - 1) {
                html += `<div style="display: flex; align-items: center; font-size: 2.5em; color: #667eea; font-weight: bold;">→</div>`;
            }
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += `
                <div style="text-align: center; margin-top: 40px; display: flex; gap: 20px; justify-content: center;">
                    <button onclick="downloadAllChains()" class="btn btn-success" style="padding: 15px 40px; font-size: 1.2em;">
                        📥 Tüm Sonuçları İndir
                    </button>
                    <button onclick="location.reload()" class="btn btn-primary" style="padding: 15px 40px; font-size: 1.2em;">
                        🔄 Yeni Oyun
                    </button>
                </div>
            </div>
        </div>
    `;
    
    gamePlaySection.innerHTML = html;
}

// Görselleri indirme fonksiyonları
function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}_${Date.now()}.png`;
    link.click();
}

function downloadChain(chainIndex) {
    alert(`Zincir ${chainIndex + 1} indiriliyor...`);
    // Tüm resimleri indir
    const drawings = document.querySelectorAll(`.chain-drawing-${chainIndex}-img`);
    drawings.forEach((img, i) => {
        setTimeout(() => {
            downloadImage(img.src, `chain${chainIndex + 1}_step${i + 1}`);
        }, i * 200);
    });
}

function downloadAllChains() {
    const allImages = document.querySelectorAll('[class*="chain-drawing-"] img');
    allImages.forEach((img, i) => {
        setTimeout(() => {
            downloadImage(img.src, `gartic_phone_${i + 1}`);
        }, i * 200);
    });
    alert('Tüm görseller indiriliyor!');
}

function showGarticPhoneModal(type, data) {
    const gamePlaySection = document.getElementById('gamePlaySection');
    
    if (type === 'word') {
        // Kelime girme ekranı
        gamePlaySection.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: white; border-radius: 20px; padding: 40px;">
                <div style="text-align: center; max-width: 500px; width: 100%;">
                    <div style="font-size: 3em; margin-bottom: 20px; color: #e74c3c; font-weight: bold;" id="wordTimer">15</div>
                    <h2 style="color: #667eea; margin-bottom: 20px; font-size: 2em;">📝 Bir Kelime Yazın</h2>
                    <p style="color: #666; margin-bottom: 30px;">Diğer oyuncular bu kelimeyi çizmeye çalışacak!</p>
                    <input type="text" id="garticWordInput" placeholder="Kelime girin..." 
                           style="width: 100%; padding: 20px; font-size: 1.2em; border: 2px solid #667eea; border-radius: 10px; margin-bottom: 20px; text-align: center;" maxlength="30">
                    <button onclick="submitGarticWord()" class="btn btn-primary" style="width: 100%; padding: 15px; font-size: 1.2em;">
                        Gönder
                    </button>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            document.getElementById('garticWordInput').focus();
            document.getElementById('garticWordInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submitGarticWord();
            });
        }, 100);
        
    } else if (type === 'draw') {
        // Çizim ekranı
        gamePlaySection.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 20px; height: 100%;">
                <div style="background: white; padding: 20px; border-radius: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <div></div>
                    <h2 style="color: #667eea; text-align: center; margin: 0;">
                        Kelimeyi Çizin: <span style="color: #e74c3c;">${data}</span>
                    </h2>
                    <div style="font-size: 2em; color: #e74c3c; font-weight: bold; min-width: 60px; text-align: center;" id="drawTimer">30</div>
                </div>
                <div style="flex: 1; background: white; border-radius: 15px; padding: 20px; display: flex; flex-direction: column;">
                    <canvas id="garticCanvas" width="800" height="600" style="border: 3px solid #e0e0e0; border-radius: 10px; background: white; max-width: 100%; cursor: crosshair; margin: 0 auto;"></canvas>
                    <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: center; align-items: center; flex-wrap: wrap;">
                        <label>Renk:</label>
                        <input type="color" id="garticColor" value="#000000" style="width: 50px; height: 40px; cursor: pointer;">
                        <label>Kalınlık:</label>
                        <input type="range" id="garticSize" min="1" max="20" value="3" style="width: 150px;">
                        <span id="garticSizeDisplay" style="min-width: 30px; font-weight: bold;">3</span>
                        <button onclick="clearGarticCanvas()" class="btn btn-secondary">🗑️ Temizle</button>
                        <button onclick="submitGarticDrawing()" class="btn btn-primary" style="padding: 15px 40px; font-size: 1.1em;">
                            ✓ Çizimi Gönder
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => initializeGarticCanvas(), 100);
        
    } else if (type === 'guess') {
        // Tahmin ekranı
        gamePlaySection.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: white; border-radius: 20px; padding: 40px;">
                <div style="text-align: center; max-width: 700px; width: 100%;">
                    <div style="font-size: 3em; margin-bottom: 20px; color: #e74c3c; font-weight: bold;" id="guessTimer">20</div>
                    <h2 style="color: #667eea; margin-bottom: 30px; font-size: 2em;">🔍 Bu Çizimi Tahmin Edin</h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 15px; margin-bottom: 30px;">
                        <img src="${data}" style="max-width: 100%; max-height: 400px; border-radius: 10px; border: 3px solid #667eea;" />
                    </div>
                    <input type="text" id="garticGuessInput" placeholder="Bu ne olabilir?" 
                           style="width: 100%; padding: 20px; font-size: 1.2em; border: 2px solid #667eea; border-radius: 10px; margin-bottom: 20px; text-align: center;" maxlength="30">
                    <button onclick="submitGarticGuess()" class="btn btn-primary" style="width: 100%; padding: 15px; font-size: 1.2em;">
                        ✓ Tahmini Gönder
                    </button>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            document.getElementById('garticGuessInput').focus();
            document.getElementById('garticGuessInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submitGarticGuess();
            });
        }, 100);
    }
}

async function submitGarticWord() {
    const input = document.getElementById('garticWordInput');
    const word = input.value.trim();
    
    if (!word) {
        alert('Lütfen bir kelime girin!');
        return;
    }
    
    // Timer'ı durdur
    if (wordTimerInterval) {
        clearInterval(wordTimerInterval);
    }
    
    try {
        await gameConnection.invoke("SubmitWord", currentRoom, word);
        // Sadece kendi ekranımızı bekleme moduna al
        showWaitingScreen();
    } catch (error) {
        console.error('Submit word error:', error);
    }
}

function showWaitingScreen() {
    console.log('⏳ Bekleme ekranı gösteriliyor...');
    const gamePlaySection = document.getElementById('gamePlaySection');
    gamePlaySection.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: white; border-radius: 20px; padding: 40px;">
            <div style="text-align: center;">
                <div style="font-size: 4em; margin-bottom: 20px;">⏳</div>
                <h2 style="color: #667eea; margin-bottom: 20px;">Görev Tamamlandı!</h2>
                <p style="font-size: 1.2em; color: #666;">
                    Diğer oyuncular görevlerini tamamlayınca devam edeceğiz...
                </p>
                <div class="loading-dots" style="margin-top: 30px; font-size: 2em; color: #667eea;">
                    <span>.</span><span>.</span><span>.</span>
                </div>
            </div>
        </div>
    `;
}

let garticCanvas = null;
let garticCtx = null;

function initializeGarticCanvas() {
    garticCanvas = document.getElementById('garticCanvas');
    garticCtx = garticCanvas.getContext('2d');
    garticCtx.lineCap = 'round';
    garticCtx.lineJoin = 'round';
    garticCtx.fillStyle = 'white';
    garticCtx.fillRect(0, 0, garticCanvas.width, garticCanvas.height);
    
    let drawing = false;
    let prevX = 0;
    let prevY = 0;
    
    const colorPicker = document.getElementById('garticColor');
    const sizePicker = document.getElementById('garticSize');
    const sizeDisplay = document.getElementById('garticSizeDisplay');
    
    // Size display güncelle
    sizePicker.addEventListener('input', () => {
        sizeDisplay.textContent = sizePicker.value;
    });
    
    garticCanvas.addEventListener('mousedown', (e) => {
        drawing = true;
        const rect = garticCanvas.getBoundingClientRect();
        prevX = e.clientX - rect.left;
        prevY = e.clientY - rect.top;
    });
    
    garticCanvas.addEventListener('mousemove', (e) => {
        if (!drawing) return;
        const rect = garticCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        garticCtx.strokeStyle = colorPicker.value;
        garticCtx.lineWidth = sizePicker.value;
        garticCtx.beginPath();
        garticCtx.moveTo(prevX, prevY);
        garticCtx.lineTo(x, y);
        garticCtx.stroke();
        
        prevX = x;
        prevY = y;
    });
    
    garticCanvas.addEventListener('mouseup', () => { drawing = false; });
    garticCanvas.addEventListener('mouseleave', () => { drawing = false; });
}

function clearGarticCanvas() {
    if (garticCtx) {
        garticCtx.fillStyle = 'white';
        garticCtx.fillRect(0, 0, garticCanvas.width, garticCanvas.height);
    }
}

async function submitGarticDrawing() {
    if (!garticCanvas) return;
    
    // Timer'ı durdur
    if (drawTimerInterval) {
        clearInterval(drawTimerInterval);
    }
    
    const drawingData = garticCanvas.toDataURL('image/png');
    
    try {
        await gameConnection.invoke("SubmitDrawing", currentRoom, currentChainId, drawingData);
        showWaitingScreen();
    } catch (error) {
        console.error('Submit drawing error:', error);
    }
}

async function submitGarticGuess() {
    const input = document.getElementById('garticGuessInput');
    const guess = input.value.trim();
    
    if (!guess) {
        alert('Lütfen bir tahmin girin!');
        return;
    }
    
    // Timer'ı durdur
    if (guessTimerInterval) {
        clearInterval(guessTimerInterval);
    }
    
    try {
        await gameConnection.invoke("SubmitGuessWord", currentRoom, currentChainId, guess);
        showWaitingScreen();
    } catch (error) {
        console.error('Submit guess error:', error);
    }
}

// Canvas işlemleri
function initializeCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    let drawing = false;
    let prevX = 0;
    let prevY = 0;
    
    canvas.addEventListener('mousedown', (e) => {
        if (!isMyTurn) return;
        drawing = true;
        const rect = canvas.getBoundingClientRect();
        prevX = e.clientX - rect.left;
        prevY = e.clientY - rect.top;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!drawing || !isMyTurn) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const drawData = { x, y, prevX, prevY, color: currentColor, size: currentSize, type: 'draw' };
        drawOnCanvas(drawData);
        gameConnection.invoke("SendDrawing", currentRoom, drawData);
        
        prevX = x;
        prevY = y;
    });
    
    canvas.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('mouseleave', () => { drawing = false; });
}

function drawOnCanvas(data) {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.beginPath();
    ctx.moveTo(data.prevX, data.prevY);
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
}

function clearCanvasLocal() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

document.getElementById('colorPicker').addEventListener('change', (e) => {
    currentColor = e.target.value;
});

document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
        currentColor = btn.dataset.color;
        document.getElementById('colorPicker').value = currentColor;
    });
});

document.getElementById('brushSize').addEventListener('input', (e) => {
    currentSize = e.target.value;
    document.getElementById('sizeDisplay').textContent = currentSize;
});

document.getElementById('clearBtn').addEventListener('click', () => {
    if (!isMyTurn) return;
    clearCanvasLocal();
    gameConnection.invoke("ClearCanvas", currentRoom);
});

document.getElementById('guessBtn').addEventListener('click', sendGuess);
document.getElementById('guessInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendGuess();
});

async function sendGuess() {
    const guess = document.getElementById('guessInput').value.trim();
    if (!guess) return;
    
    await gameConnection.invoke("SendGuess", currentRoom, guess);
    document.getElementById('guessInput').value = '';
}

function updatePlayersList(players) {
    const playersArray = Object.values(players);
    document.getElementById('playerCount').textContent = `${playersArray.length} Oyuncu`;
    
    document.getElementById('playersList').innerHTML = playersArray
        .sort((a, b) => b.score - a.score)
        .map(p => `
            <div class="player-item">
                <span class="player-name">${p.name}</span>
                <span class="player-score">${p.score} 🏆</span>
            </div>
        `).join('');
}

function updateScores(scores) {
    document.getElementById('playersList').innerHTML = scores
        .sort((a, b) => b.score - a.score)
        .map(p => `
            <div class="player-item">
                <span class="player-name">${p.name}</span>
                <span class="player-score">${p.score} 🏆</span>
            </div>
        `).join('');
}

function addGameChatMessage(text, type = 'system', playerName = '') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${type}`;
    
    if (playerName) {
        msgDiv.innerHTML = `<span class="player">${playerName}:</span>${text}`;
    } else {
        msgDiv.textContent = text;
    }
    
    const container = document.getElementById('chatMessages');
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// ==== YARDIMCI FONKSİYONLAR ====
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    
    if (screenName === 'menu') {
        document.getElementById('currentUsername').textContent = currentUser.username;
    }
}

// Sayfa yüklendiğinde
window.addEventListener('load', async () => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        console.log('🔐 Kaydedilmiş oturum bulundu:', currentUser.username);
        showScreen('menu');
        await initializeChatConnection();
        console.log('✅ Chat bağlantısı kuruldu');
    } else {
        console.log('👤 Oturum yok, giriş ekranına yönlendiriliyor');
        showScreen('auth');
    }
});
