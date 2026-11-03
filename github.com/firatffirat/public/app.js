
const socket = io();

let gameData = {
  champions: [],
  items: []
};

let currentRoom = null;
let selectedChampion = null;
let selectedKaynForm = null;
let playerName = "";

const $ = (id) => document.getElementById(id);

const screens = [
  "connectionScreen",
  "lobbyScreen",
  "championScreen",
  "itemScreen",
  "battleScreen"
];

function showScreen(screenId) {
  screens.forEach(id => {
    $(id).classList.toggle("hidden", id !== screenId);
  });
}

function message(id, text) {
  $(id).textContent = text || "";
}

function setConnectionStatus(text) {
  $("connectionStatus").textContent = text;
}

function escapeText(value) {
  return String(value ?? "");
}

// SUNUCUYA BAĞLANMA

socket.on("connect", () => {
  setConnectionStatus("Sunucuya bağlandı");
});

socket.on("disconnect", () => {
  setConnectionStatus("Bağlantı kesildi");
});

socket.on("connect_error", () => {
  setConnectionStatus("Bağlantı kurulamadı");
});

// OYUN VERİLERİNİ AL

async function loadGameData() {
  try {
    const response = await fetch("/game-data");

    if (!response.ok) {
      throw new Error("Oyun verileri alınamadı.");
    }

    gameData = await response.json();

    if (!Array.isArray(gameData.champions) ||
        !Array.isArray(gameData.items)) {
      throw new Error("Oyun verileri beklenen formatta değil.");
    }
  } catch (error) {
    console.error(error);
    message("connectionMessage", "Oyun verileri yüklenemedi.");
  }
}

loadGameData();

// ODA OLUŞTUR

$("createRoomBtn").addEventListener("click", () => {
  playerName = $("playerName").value.trim();

  if (!playerName) {
    message("connectionMessage", "Önce oyuncu adını yaz.");
    return;
  }

  socket.emit("room:create", { name: playerName }, (result) => {
    if (!result || !result.ok) {
      message("connectionMessage",
        result?.error || "Oda oluşturulamadı.");
      return;
    }

    currentRoom = result.code;
    $("roomCode").textContent = result.code;
    showScreen("lobbyScreen");
    message("lobbyMessage", "Oda oluşturuldu. Rakibin bekleniyor.");
  });
});

// ODAYA KATIL

$("joinRoomBtn").addEventListener("click", () => {
  playerName = $("playerName").value.trim();

  const code = $("roomCodeInput").value.trim().toUpperCase();

  if (!playerName) {
    message("connectionMessage", "Önce oyuncu adını yaz.");
    return;
  }

  if (!code) {
    message("connectionMessage", "Oda kodunu gir.");
    return;
  }

  socket.emit("room:join", {
    code,
    name: playerName
  }, (result) => {
    if (!result || !result.ok) {
      message("connectionMessage",
        result?.error || "Odaya katılınamadı.");
      return;
    }

    currentRoom = result.code;
    $("roomCode").textContent = result.code;
    showScreen("lobbyScreen");
  });
});

// ODA KODUNU KOPYALA

$("copyRoomBtn").addEventListener("click", async () => {
  const code = $("roomCode").textContent;

  try {
    await navigator.clipboard.writeText(code);
    $("copyRoomBtn").textContent = "KOPYALANDI";
  } catch {
    message("lobbyMessage", "Oda kodun: " + code);
  }
});

// OYUNCUYU BUL

function getMe(room) {
  return room.players?.find(player =>
    player.id === socket.id ||
    player.socketId === socket.id ||
    player.playerId === socket.id
  ) || room.players?.find(player =>
    player.name === playerName
  );
}

function getCurrentPicker(room) {
  return room.currentPicker;
}

function isMyTurn(room) {
  const picker = getCurrentPicker(room);
  const me = getMe(room);

  if (!picker || !me) return false;

  return picker === socket.id ||
    picker === me.id ||
    picker === me.socketId ||
    picker === me.name;
}

// SUNUCUDAN ODA GÜNCELLEMESİ

socket.on("room:update", (room) => {
  currentRoom = room.code || currentRoom;
  updateGame(room);
});

function updateGame(room) {
  renderPlayers(room);

  if (room.phase === "waiting") {
    showScreen("lobbyScreen");
    message("lobbyMessage", "İkinci oyuncu bekleniyor.");
  }

  if (room.phase === "champions") {
    showScreen("championScreen");
    renderChampions(room);
  }

  if (room.phase === "items") {
    showScreen("itemScreen");
    renderItems(room);
  }

  if (room.phase === "battle" || room.phase === "finished") {
    showScreen("battleScreen");
    renderBattle(room);
  }
}

// OYUNCU LİSTESİ

function renderPlayers(room) {
  $("roomCode").textContent = room.code || currentRoom || "------";

  const players = room.players || [];

  $("playersList").innerHTML = "";

  players.forEach((player, index) => {
    const div = document.createElement("div");
    div.className = "player-slot";

    const champ = player.champion?.name ||
      player.champion ||
      "Şampiyon seçilmedi";

    div.textContent =
      `${index + 1}. ${escapeText(player.name)} — ${escapeText(champ)}`;

    $("playersList").appendChild(div);
  });

  if (players.length < 2) {
    message("lobbyMessage", "Rakibin odaya katılması bekleniyor.");
  } else {
    message("lobbyMessage", "İki oyuncu da hazır.");
  }
}

// ŞAMPİYON SEÇİMİ

function renderChampions(room) {
  const grid = $("championGrid");
  const me = getMe(room);
  const myTurn = isMyTurn(room);

  grid.innerHTML = "";

  if (!myTurn) {
    message("championMessage", "Rakibinin şampiyon seçmesi bekleniyor.");
  } else {
    message("championMessage", "Sıra sende. Şampiyonunu seç.");
  }

  gameData.champions.forEach(champion => {
    const card = document.createElement("button");
    card.className = "champion-card";

    const icon = document.createElement("div");
    icon.className = "champion-icon";
    icon.textContent = "⚔";

    const name = document.createElement("h3");
    name.textContent = champion.name;

    const role = document.createElement("p");
    role.textContent = champion.role || "Şampiyon";

    const stats = document.createElement("p");
    stats.textContent =
      `Can ${champion.hp} • Saldırı ${champion.atk}`;

    card.append(icon, name, role, stats);

    card.disabled = !myTurn || !!me?.champion;

    card.addEventListener("click", () => {
      selectedChampion = champion;

      if (champion.id === "kayn") {
        $("kaynFormBox").classList.remove("hidden");
        message("championMessage", "Kayn formunu seç.");
      } else {
        sendChampionPick(champion.id, null);
      }
    });

    grid.appendChild(card);
  });

  if (me?.champion) {
    message("championMessage", "Şampiyonunu seçtin. Rakibin bekleniyor.");
  }
}

function sendChampionPick(championId, form) {
  socket.emit("champion:pick", {
    championId,
    form
  });

  $("kaynFormBox").classList.add("hidden");
}

$("shadowFormBtn").addEventListener("click", () => {
  if (selectedChampion?.id === "kayn") {
    sendChampionPick("kayn", "shadow");
  }
});

$("rhaastFormBtn").addEventListener("click", () => {
  if (selectedChampion?.id === "kayn") {
    sendChampionPick("kayn", "rhaast");
  }
});

// EŞYA SEÇİMİ

function renderItems(room) {
  const grid = $("itemGrid");
  const me = getMe(room);
  const myTurn = isMyTurn(room);

  grid.innerHTML = "";

  const owned = me?.items || [];

  $("ownedItems").innerHTML = "";

  owned.forEach(item => {
    const div = document.createElement("div");
    div.className = "owned-item";
    div.textContent = item.name;
    $("ownedItems").appendChild(div);
  });

  $("itemCount").textContent = `${owned.length} / 6 eşya`;

  if (owned.length >= 6) {
    message("itemMessage", "Altı eşyan tamamlandı. Rakibin bekleniyor.");
  } else if (myTurn) {
    message("itemMessage", "Sıra sende. Bir eşya seç.");
  } else {
    message("itemMessage", "Rakibinin eşya seçmesi bekleniyor.");
  }

  gameData.items.forEach(item => {
    const card = document.createElement("button");
    card.className = "item-card";

    const icon = document.createElement("div");
    icon.className = "item-icon";
    icon.textContent = "✦";

    const name = document.createElement("h3");
    name.textContent = item.name;

    const stats = document.createElement("p");
    stats.textContent =
      `Saldırı ${item.atk || 0} • Savunma ${item.def || 0}`;

    const hp = document.createElement("p");
    hp.textContent =
      `Can +${item.hp || 0} • Güç +${item.power || 0}`;

    card.append(icon, name, stats, hp);

    card.disabled = !myTurn || owned.length >= 6;

    card.addEventListener("click", () => {
      socket.emit("item:pick", {
        itemId: item.id
      });
    });

    grid.appendChild(card);
  });
}

// SAVAŞ EKRANI

function renderBattle(room) {
  const battle = room.battle;

  if (!battle) {
    message("battleLog", "Savaş hazırlanıyor...");
    return;
  }

  const fighters = battle.fighters || [];

  if (fighters[0]) {
    renderFighter(fighters[0], 1);
  }

  if (fighters[1]) {
    renderFighter(fighters[1], 2);
  }

  const logs = battle.log || room.log || [];

  $("battleLog").innerHTML = "";

  logs.forEach(entry => {
    const p = document.createElement("p");
    p.textContent = typeof entry === "string"
      ? entry
      : JSON.stringify(entry);

    $("battleLog").appendChild(p);
  });

  if (room.winner) {
    $("winnerBox").classList.remove("hidden");
    $("winnerName").textContent = "KAZANAN: " + room.winner;
  }
}

function renderFighter(fighter, number) {
  $(`fighter${number === 1 ? "One" : "Two"}Name`).textContent =
    fighter.name || fighter.champion || "Şampiyon";

  const maxHp = Number(fighter.maxHp || fighter.hp || 1);
  const hp = Math.max(0, Number(fighter.hp || 0));
  const percent = Math.max(0, Math.min(100, hp / maxHp * 100));

  const health = $(
    `fighter${number === 1 ? "One" : "Two"}Health`
  );

  health.style.width = percent + "%";

  $(`fighter${number === 1 ? "One" : "Two"}Stats`).textContent =
    `Can: ${hp} / ${maxHp} • Saldırı: ${fighter.atk || 0}`;
}

// HATA MESAJLARI

socket.on("room:error", (error) => {
  message("connectionMessage",
    typeof error === "string" ? error : "Bir oda hatası oluştu.");
});

// YENİ OYUN BİLGİSİ

$("playAgainBtn").addEventListener("click", () => {
  message("battleLog",
    "Yeni oyun için yeni bir oda oluşturmanız gerekiyor.");
});
