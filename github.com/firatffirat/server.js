
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const rooms = {};

const champions = {
  zed: {
    id: "zed",
    name: "Zed",
    hp: 980,
    atk: 78,
    def: 38,
    power: 0
  },
  yasuo: {
    id: "yasuo",
    name: "Yasuo",
    hp: 1080,
    atk: 72,
    def: 44,
    power: 0
  },
  ahri: {
    id: "ahri",
    name: "Ahri",
    hp: 940,
    atk: 58,
    def: 35,
    power: 78
  },
  darius: {
    id: "darius",
    name: "Darius",
    hp: 1280,
    atk: 82,
    def: 58,
    power: 0
  },
  lux: {
    id: "lux",
    name: "Lux",
    hp: 920,
    atk: 48,
    def: 34,
    power: 88
  },
  jinx: {
    id: "jinx",
    name: "Jinx",
    hp: 1000,
    atk: 76,
    def: 36,
    power: 0
  }
};

const items = {
  blade: {
    id: "blade",
    name: "Saldırı Kılıcı",
    atk: 18,
    def: 0,
    hp: 0,
    power: 0,
    lifesteal: 0,
    crit: 0
  },
  armor: {
    id: "armor",
    name: "Zincir Yelek",
    atk: 0,
    def: 20,
    hp: 0,
    power: 0,
    lifesteal: 0,
    crit: 0
  },
  crystal: {
    id: "crystal",
    name: "Büyü Kristali",
    atk: 0,
    def: 0,
    hp: 0,
    power: 22,
    lifesteal: 0,
    crit: 0
  },
  vamp: {
    id: "vamp",
    name: "Yaşam Kılıcı",
    atk: 10,
    def: 0,
    hp: 0,
    power: 0,
    lifesteal: 8,
    crit: 0
  },
  boots: {
    id: "boots",
    name: "Gezgin Çizmesi",
    atk: 0,
    def: 8,
    hp: 0,
    power: 0,
    lifesteal: 0,
    crit: 0
  },
  heart: {
    id: "heart",
    name: "Dev Kemeri",
    atk: 0,
    def: 0,
    hp: 180,
    power: 0,
    lifesteal: 0,
    crit: 0
  },
  crit: {
    id: "crit",
    name: "Keskin Kenar",
    atk: 12,
    def: 0,
    hp: 0,
    power: 0,
    lifesteal: 0,
    crit: 15
  },
  ward: {
    id: "ward",
    name: "Direnç Pelerini",
    atk: 0,
    def: 14,
    hp: 60,
    power: 0,
    lifesteal: 0,
    crit: 0
  }
};

function makeCode() {
  let code;

  do {
    code = Math.random().toString(36).substring(2, 7).toUpperCase();
  } while (rooms[code]);

  return code;
}

function sendRoom(room) {
  io.to(room.code).emit("room:update", {
    code: room.code,
    hostId: room.hostId,
    players: room.players,
    phase: room.phase,
    turn: room.turn,
    log: room.log,
    winner: room.winner,
    battle: room.battle
  });
}

function getPlayer(room, socketId) {
  return room.players.find(player => player.id === socketId);
}

function finishBattle(room) {
  const fighters = room.players.map(player => {
    const champion = player.champion;

    const stats = {
      hp: champion.hp,
      atk: champion.atk,
      def: champion.def,
      power: champion.power,
      lifesteal: 0,
      crit: 0
    };

    player.items.forEach(item => {
      stats.hp += item.hp;
      stats.atk += item.atk;
      stats.def += item.def;
      stats.power += item.power;
      stats.lifesteal += item.lifesteal;
      stats.crit += item.crit;
    });

    return {
      id: player.id,
      name: player.name,
      champion: champion.name,
      hp: stats.hp,
      maxHp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      power: stats.power,
      lifesteal: stats.lifesteal,
      crit: stats.crit
    };
  });

  const lines = [];
  let round = 1;
  let attacker = 0;

  lines.push("SAVAŞ BAŞLADI!");

  while (fighters[0].hp > 0 && fighters[1].hp > 0 && round <= 30) {
    const current = fighters[attacker];
    const enemy = fighters[1 - attacker];

    let damage = current.atk + Math.floor(current.power * 0.45);

    if (Math.random() * 100 < current.crit) {
      damage = Math.floor(damage * 1.6);
      lines.push(current.champion + " kritik vuruş yaptı!");
    }

    damage = Math.max(5, damage - Math.floor(enemy.def * 0.45));

    enemy.hp = Math.max(0, enemy.hp - damage);

    const healing = Math.floor(damage * current.lifesteal / 100);
    current.hp = Math.min(current.maxHp, current.hp + healing);

    lines.push(
      round + ". Tur: " +
      current.champion + " saldırdı. " +
      enemy.champion + " " + damage +
      " hasar aldı."
    );

    if (healing > 0) {
      lines.push(current.champion + " " + healing + " can kazandı.");
    }

    if (enemy.hp <= 0) break;

    attacker = 1 - attacker;
    round++;
  }

  let winner;

  if (fighters[0].hp <= 0 && fighters[1].hp <= 0) {
    winner = "Berabere";
  } else {
    const winningFighter = fighters[0].hp > 0 ? fighters[0] : fighters[1];
    winner = winningFighter.name;
    lines.push("KAZANAN: " + winningFighter.champion);
  }

  room.winner = winner;
  room.battle = {
    fighters,
    lines,
    winner
  };

  room.phase = "finished";
  room.log.push("Savaş tamamlandı.");
}

io.on("connection", socket => {

  console.log("Oyuncu bağlandı:", socket.id);

  // ODA OLUŞTUR
  socket.on("room:create", (data = {}, callback) => {
    const code = makeCode();

    const room = {
      code,
      hostId: socket.id,
      players: [
        {
          id: socket.id,
          name: String(data.name || "Oyuncu 1").slice(0, 20),
          champion: null,
          items: []
        }
      ],
      phase: "waiting",
      turn: 0,
      log: ["Oda oluşturuldu. İkinci oyuncu bekleniyor."],
      winner: null,
      battle: null
    };

    rooms[code] = room;

    // ÖNEMLİ: Odayı oluşturan oyuncuyu da odaya dahil et.
    socket.join(code);

    sendRoom(room);

    if (typeof callback === "function") {
      callback({
        ok: true,
        code
      });
    }

    console.log("Oda oluşturuldu:", code);
  });

  // ODAYA KATIL
  socket.on("room:join", (data = {}, callback) => {
    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms[code];

    if (!room) {
      if (typeof callback === "function") {
        callback({
          ok: false,
          error: "Oda bulunamadı."
        });
      }
      return;
    }

    if (room.players.length >= 2) {
      if (typeof callback === "function") {
        callback({
          ok: false,
          error: "Oda dolu."
        });
      }
      return;
    }

    if (room.players.some(player => player.id === socket.id)) {
      if (typeof callback === "function") {
        callback({
          ok: true,
          code
        });
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
    room.log.push("İkinci oyuncu katıldı. Şampiyon seçimi başladı.");

    sendRoom(room);

    if (typeof callback === "function") {
      callback({
        ok: true,
        code
      });
    }

    console.log("Oyuncu odaya katıldı:", code);
  });

  // ŞAMPİYON SEÇ
  socket.on("champion:pick", (data = {}) => {
    const room = Object.values(rooms).find(room =>
      room.players.some(player => player.id === socket.id)
    );

    if (!room || room.phase !== "draft") return;

    const player = getPlayer(room, socket.id);
    const champion = champions[data.championId];

    if (!player || !champion) return;
    if (player.champion) return;

    player.champion = { ...champion };

    room.log.push(
      player.name + " " + champion.name + " seçti."
    );

    sendRoom(room);
  });

  // EŞYA SEÇ
  socket.on("item:pick", (data = {}) => {
    const room = Object.values(rooms).find(room =>
      room.players.some(player => player.id === socket.id)
    );

    if (!room || room.phase !== "draft") return;

    if (!room.players.every(player => player.champion)) return;

    const player = getPlayer(room, socket.id);
    const item = items[data.itemId];

    if (!player || !item) return;

    const activePlayer = room.players[room.turn % 2];

    if (activePlayer.id !== socket.id) return;

    if (player.items.length >= 3) return;

    if (player.items.some(existing => existing.id === item.id)) return;

    player.items.push({ ...item });

    room.log.push(
      player.name + " " + item.name + " aldı."
    );

    room.turn++;

    const totalItems = room.players.reduce(
      (total, p) => total + p.items.length,
      0
    );

    if (totalItems >= 6) {
      finishBattle(room);
    }

    sendRoom(room);
  });

  // BAĞLANTI KESİLİRSE
  socket.on("disconnect", () => {
    console.log("Oyuncu ayrıldı:", socket.id);

    for (const code of Object.keys(rooms)) {
      const room = rooms[code];

      const index = room.players.findIndex(
        player => player.id === socket.id
      );

      if (index !== -1) {
        room.players.splice(index, 1);

        if (room.players.length === 0) {
          delete rooms[code];
        } else {
          room.phase = "waiting";
          room.turn = 0;
          room.log.push("Oyuncunun bağlantısı kesildi.");
          sendRoom(room);
        }

        break;
      }
    }
  });

});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: Object.keys(rooms).length
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("LoL Duel sunucusu çalışıyor. Port:", PORT);
});
