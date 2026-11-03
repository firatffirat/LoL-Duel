
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const rooms = {};

// ==========================================
// 1. ŞAMPİYON VERİTABANI - 28 ŞAMPİYON
// ==========================================

const champions = [
  ["zed","Zed","Assassin",950,82,35,0,"shadow"],
  ["akali","Akali","Assassin",1000,65,35,75,"energy"],
  ["katarina","Katarina","Assassin",950,76,32,40,"reset"],
  ["talon","Talon","Assassin",1020,80,40,0,"bleed"],

  ["yasuo","Yasuo","Fighter",1100,75,48,0,"wind"],
  ["yone","Yone","Fighter",1080,78,43,20,"spirit"],
  ["darius","Darius","Fighter",1350,84,62,0,"bleed"],
  ["garen","Garen","Fighter",1400,72,65,0,"execute"],
  ["riven","Riven","Fighter",1120,80,48,0,"combo"],
  ["sett","Sett","Fighter",1450,76,58,0,"grit"],

  ["ahri","Ahri","Mage",980,48,35,90,"charm"],
  ["lux","Lux","Mage",950,45,32,100,"shield"],
  ["veigar","Veigar","Mage",900,42,30,125,"scaling"],
  ["annie","Annie","Mage",1000,48,38,90,"stun"],
  ["morgana","Morgana","Mage",1100,45,48,80,"drain"],

  ["jinx","Jinx","Marksman",1050,85,32,0,"ramp"],
  ["jhin","Jhin","Marksman",1000,105,35,0,"fourth"],
  ["ashe","Ashe","Marksman",1080,72,40,0,"slow"],

  ["leesin","Lee Sin","Jungle",1150,80,48,0,"combo"],
  ["masteryi","Master Yi","Jungle",1050,90,38,0,"speed"],
  ["shaco","Shaco","Jungle",1000,78,38,0,"clone"],
  ["kayn","Kayn","Jungle",1150,78,48,25,"form"],
  ["khazix","Kha'Zix","Jungle",1000,88,38,0,"isolation"],
  ["evelynn","Evelynn","Jungle",980,55,35,100,"ambush"],
  ["warwick","Warwick","Jungle",1350,72,60,0,"hunt"],
  ["viego","Viego","Jungle",1150,82,45,0,"possess"],
  ["nocturne","Nocturne","Jungle",1100,80,42,25,"fear"],
  ["ekko","Ekko","Jungle",1050,65,40,90,"rewind"]
].map(([id,name,role,hp,atk,def,power,mechanic]) => ({
  id,name,role,hp,atk,def,power,mechanic
}));

// ==========================================
// 2. EŞYA VERİTABANI - 30 EŞYA
// ==========================================

const items = [
  ["blade","Saldırı Kılıcı",0,18,0,0,0],
  ["greatsword","Dev Kılıç",0,35,0,0,0],
  ["dagger","Hançer",0,10,0,0,12],
  ["crit","Keskin Kenar",0,20,0,0,15],
  ["blood","Kan Kılıcı",0,18,100,0,8],
  ["vamp","Yaşam Hırsızı",0,12,0,0,12],
  ["bow","Hız Yayı",0,15,0,0,20],
  ["armor","Zincir Yelek",20,0,0,0,0],
  ["plate","Çelik Zırh",35,0,100,0,0],
  ["helm","Direnç Miğferi",20,0,120,0,0],
  ["heart","Dev Kemeri",0,0,250,0,0],
  ["shield","Koruyucu Kalkan",25,0,100,0,0],
  ["boots","Gezgin Çizmesi",12,5,0,0,5],
  ["crystal","Büyü Kristali",0,0,0,25,0],
  ["rod","Büyü Asası",0,0,0,45,0],
  ["orb","Gizemli Küre",10,0,50,30,0],
  ["tome","Kadim Kitap",0,0,0,35,0],
  ["staff","Bilge Asası",0,0,0,55,0],
  ["void","Hiçlik Değneği",0,0,0,40,0],
  ["mana","Mana Kristali",0,0,100,20,0],
  ["thorn","Dikenli Zırh",30,0,80,0,0],
  ["guardian","Muhafız Zırhı",45,0,150,0,0],
  ["rage","Öfke Bıçağı",0,25,0,0,10],
  ["shadow","Gölge Bıçağı",0,30,0,0,8],
  ["executioner","Cellat Kılıcı",0,28,0,0,5],
  ["crown","Büyü Tacı",0,0,50,55,0],
  ["angel","Diriliş Zırhı",20,10,120,0,0],
  ["frozen","Donmuş Kalp",40,0,100,0,0],
  ["demon","Şeytan Kitabı",0,0,0,35,5],
  ["destroyer","Yıkıcı",15,32,0,0,5]
].map(([id,name,def,atk,hp,power,crit]) => ({
  id,name,def,atk,hp,power,crit
}));

// ==========================================
// 3. ODA VE OYUNCU SİSTEMİ
// ==========================================

function makeCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2,7).toUpperCase();
  } while (rooms[code]);
  return code;
}

function findRoom(socketId) {
  return Object.values(rooms).find(room =>
    room.players.some(player => player.id === socketId)
  );
}

function publicRoom(room) {
  return {
    code: room.code,
    phase: room.phase,
    players: room.players,
    turn: room.turn,
    currentPicker: room.players[room.turn % 2]?.id || null,
    log: room.log,
    battle: room.battle,
    winner: room.winner
  };
}

function updateRoom(room) {
  io.to(room.code).emit("room:update", publicRoom(room));
}

// ==========================================
// 4. KAYN FORM SEÇİMİ VE ŞAMPİYON SEÇİMİ
// ==========================================

function selectChampion(player, championId, form) {
  const champion = champions.find(c => c.id === championId);

  if (!champion) return false;
  if (player.champion) return false;

  const selected = { ...champion };

  if (selected.id === "kayn") {
    if (!["shadow","rhaast"].includes(form)) return false;

    if (form === "shadow") {
      selected.name = "Gölge Suikastçısı Kayn";
      selected.atk += 18;
      selected.power += 25;
    } else {
      selected.name = "Kızıl Rhaast";
      selected.hp += 250;
      selected.def += 15;
    }

    selected.form = form;
  }

  player.champion = selected;
  return true;
}

// ==========================================
// 5. EŞYA İSTATİSTİKLERİ
// ==========================================

function calculateStats(player) {
  const c = player.champion;

  const stats = {
    hp: c.hp,
    maxHp: c.hp,
    atk: c.atk,
    def: c.def,
    power: c.power,
    crit: 0,
    speed: 0,
    lifesteal: 0,
    shield: 0
  };

  for (const item of player.items) {
    stats.hp += item.hp;
    stats.maxHp += item.hp;
    stats.atk += item.atk;
    stats.def += item.def;
    stats.power += item.power;
    stats.crit += item.crit;
  }

  stats.crit = Math.min(stats.crit, 75);
  return stats;
}

// ==========================================
// 6. SAVAŞ MOTORU
// ==========================================

function attack(attacker, defender, round) {
  const mechanic = attacker.mechanic;

  let damage = attacker.atk;

  // Fiziksel saldırı
  let physical = damage * 100 / (100 + Math.max(0, defender.def));

  // Büyü hasarı
  let magic = attacker.power * 0.55;

  // Şampiyon mekanikleri
  switch (mechanic) {
    case "shadow":
      if (round % 3 === 0) physical *= 2.1;
      break;

    case "wind":
      if (round % 2 === 0) physical *= 1.5;
      break;

    case "bleed":
      physical += round * 3;
      break;

    case "execute":
      if (defender.hp < defender.maxHp * 0.35) {
        physical *= 1.8;
      }
      break;

    case "combo":
      if (round % 2 === 0) physical *= 1.65;
      break;

    case "grit":
      if (attacker.hp < attacker.maxHp * 0.5) {
        physical *= 1.35;
      }
      break;

    case "charm":
      magic *= round % 3 === 0 ? 2 : 1;
      break;

    case "shield":
      if (round % 3 === 0) attacker.hp = Math.min(
        attacker.maxHp,
        attacker.hp + 70
      );
      break;

    case "scaling":
      magic += round * 5;
      break;

    case "stun":
      if (round % 3 === 0) physical *= 1.65;
      break;

    case "drain":
      attacker.hp = Math.min(
        attacker.maxHp,
        attacker.hp + 35
      );
      break;

    case "ramp":
      physical *= 1 + Math.min(round * 0.035, 0.6);
      break;

    case "fourth":
      if (round % 4 === 0) physical *= 2;
      break;

    case "slow":
      if (round % 2 === 0) physical *= 1.3;
      break;

    case "speed":
      physical *= 1 + Math.min(round * 0.025, 0.5);
      break;

    case "clone":
      if (round % 3 === 0) physical *= 1.8;
      break;

    case "form":
      physical *= c.form === "shadow" ? 1.4 : 1.15;
      if (c.form === "rhaast") {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + 65);
      }
      break;

    case "isolation":
      physical *= 1.35;
      break;

    case "ambush":
      if (round === 1 || round % 4 === 0) magic *= 2;
      break;

    case "hunt":
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + 45);
      break;

    case "possess":
      if (round % 4 === 0) {
        attacker.atk += 5;
        physical *= 1.5;
      }
      break;

    case "fear":
      if (round % 3 === 0) physical *= 1.7;
      break;

    case "rewind":
      if (round % 5 === 0) {
        attacker.hp = Math.min(
          attacker.maxHp,
          attacker.hp + 120
        );
      }
      break;
  }

  // Kritik vuruş
  const critical = Math.random() * 100 < attacker.crit;

  if (critical) physical *= 1.75;

  const totalDamage = Math.max(
    10,
    Math.floor(physical + magic)
  );

  defender.hp = Math.max(0, defender.hp - totalDamage);

  // Can çalma
  const healing = Math.floor(totalDamage * attacker.lifesteal / 100);

  attacker.hp = Math.min(
    attacker.maxHp,
    attacker.hp + healing
  );

  return {
    damage: totalDamage,
    critical,
    healing
  };
}

function startBattle(room) {
  const fighters = room.players.map(player => {
    const stats = calculateStats(player);

    return {
      id: player.id,
      name: player.name,
      champion: player.champion.name,
      mechanic: player.champion.mechanic,
      form: player.champion.form || null,
      ...stats
    };
  });

  const log = [];
  let round = 1;
  let turn = 0;

  log.push("DÜELLO BAŞLADI!");

  while (
    fighters[0].hp > 0 &&
    fighters[1].hp > 0 &&
    round <= 40
  ) {
    const attacker = fighters[turn];
    const defender = fighters[1 - turn];

    const result = attack(attacker, defender, round);

    log.push(
      `${round}. TUR: ${attacker.champion} → ${result.damage} hasar`
    );

    if (result.critical) {
      log.push("KRİTİK VURUŞ!");
    }

    if (result.healing > 0) {
      log.push(`${attacker.champion} ${result.healing} can kazandı.`);
    }

    if (defender.hp <= 0) break;

    turn = 1 - turn;
    round++;
  }

  let winner = "Berabere";

  if (fighters[0].hp > fighters[1].hp) {
    winner = fighters[0].name;
  } else if (fighters[1].hp > fighters[0].hp) {
    winner = fighters[1].name;
  }

  log.push("KAZANAN: " + winner);

  room.winner = winner;
  room.battle = {
    fighters,
    log,
    rounds: round
  };

  room.phase = "finished";
}

// ==========================================
// 7. SOCKET.IO OYUN BAĞLANTISI
// ==========================================

io.on("connection", socket => {
  console.log("Bağlandı:", socket.id);

  // ODA OLUŞTUR
  socket.on("room:create", (data = {}, callback) => {
    const code = makeCode();

    const room = {
      code,
      phase: "waiting",
      turn: 0,
      winner: null,
      battle: null,
      log: ["Oda oluşturuldu. Rakip bekleniyor."],
      players: [{
        id: socket.id,
        name: String(data.name || "Oyuncu 1").slice(0, 20),
        champion: null,
        items: []
      }]
    };

    rooms[code] = room;
    socket.join(code);

    updateRoom(room);

    if (typeof callback === "function") {
      callback({ ok: true, code });
    }
  });

  // ODAYA KATIL
  socket.on("room:join", (data = {}, callback) => {
    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms[code];

    if (!room) {
      if (typeof callback === "function") {
        callback({ ok: false, error: "Oda bulunamadı." });
      }
      return;
    }

    if (room.players.length >= 2 || room.phase !== "waiting") {
      if (typeof callback === "function") {
        callback({ ok: false, error: "Oda dolu veya oyun başlamış." });
      }
      return;
    }

    socket.join(code);

    room.players.push({
      id: socket.id,
      name: String(data.name || "Oyuncu 2").slice(0, 20),
      champion: null,
      items: []
    });

    room.phase = "draft";
    room.log.push("İkinci oyuncu katıldı.");

    updateRoom(room);

    if (typeof callback === "function") {
      callback({ ok: true, code });
    }
  });

  // ŞAMPİYON SEÇ
  socket.on("champion:pick", data => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== "draft") return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (!selectChampion(player, data.championId, data.form)) return;

    room.log.push(player.name + " şampiyonunu seçti.");

    if (room.players.every(p => p.champion)) {
      room.phase = "items";
      room.log.push("Eşya seçimi başladı.");
    }

    updateRoom(room);
  });

  // EŞYA SEÇ
  socket.on("item:pick", data => {
    const room = findRoom(socket.id);
    if (!room || room.phase !== "items") return;

    const player = room.players.find(p => p.id === socket.id);
    const activePlayer = room.players[room.turn % 2];
    const item = items.find(i => i.id === data.itemId);

    if (!player || !item) return;
    if (activePlayer.id !== socket.id) return;
    if (player.items.length >= 6) return;
    if (player.items.some(i => i.id === item.id)) return;

    player.items.push({ ...item });
    room.turn++;

    room.log.push(player.name + " " + item.name + " aldı.");

    const totalItems = room.players.reduce(
      (sum, p) => sum + p.items.length,
      0
    );

    if (totalItems === 12) {
      room.phase = "battle";
      startBattle(room);
    }

    updateRoom(room);
  });

  // BAĞLANTI KESİLİRSE
  socket.on("disconnect", () => {
    const room = findRoom(socket.id);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      delete rooms[room.code];
    } else {
      room.phase = "waiting";
      room.turn = 0;
      room.log.push("Rakibin bağlantısı kesildi.");
      updateRoom(room);
    }
  });
});

// ==========================================
// 8. SUNUCU SAĞLIK KONTROLÜ
// ==========================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    championCount: champions.length,
    itemCount: items.length,
    activeRooms: Object.keys(rooms).length
  });
});

app.get("/game-data", (req, res) => {
  res.json({
    champions,
    items
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("LoL Duel sunucusu çalışıyor:", PORT);
});
