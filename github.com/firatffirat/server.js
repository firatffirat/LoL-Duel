
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const rooms = new Map();

const champions = {
  zed: { name:"Zed", hp:980, atk:78, def:38, power:0 },
  yasuo: { name:"Yasuo", hp:1080, atk:72, def:44, power:0 },
  ahri: { name:"Ahri", hp:940, atk:58, def:35, power:78 },
  darius: { name:"Darius", hp:1280, atk:82, def:58, power:0 },
  lux: { name:"Lux", hp:920, atk:48, def:34, power:88 },
  jinx: { name:"Jinx", hp:1000, atk:76, def:36, power:0 }
};

const items = [
  {id:"blade",name:"Saldırı Kılıcı",stats:{atk:18}},
  {id:"armor",name:"Zincir Yelek",stats:{def:20}},
  {id:"crystal",name:"Büyü Kristali",stats:{power:22}},
  {id:"vamp",name:"Yaşam Kılıcı",stats:{atk:10,lifesteal:8}},
  {id:"boots",name:"Gezgin Çizmesi",stats:{def:8}},
  {id:"heart",name:"Dev Kemeri",stats:{hp:180}},
  {id:"crit",name:"Keskin Kenar",stats:{atk:12,crit:15}},
  {id:"ward",name:"Direnç Pelerini",stats:{def:14,hp:60}}
];

function findRoom(id) {
  return [...rooms.values()].find(r =>
    r.players.some(p => p.id === id)
  );
}

function sendRoom(room) {
  io.to(room.code).emit("room:update", {
    code:room.code,
    hostId:room.hostId,
    players:room.players.map(p => ({
      id:p.id,
      name:p.name,
      champion:p.champion,
      items:p.items
    })),
    phase:room.phase,
    turn:room.turn,
    log:room.log.slice(-12),
    winner:room.winner || null,
    battle:room.battle || null
  });
}

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

io.on("connection", socket => {

  socket.on("room:create", (data, callback) => {
    let code = makeCode();

    while (rooms.has(code)) {
      code = makeCode();
    }

    const player = {
      id:socket.id,
      name:(data.name || "Oyuncu 1").slice(0,18),
      champion:null,
      items:[]
    };

    const room = {
      code,
      hostId:socket.id,
      players:[player],
      phase:"waiting",
      turn:0,
      log:["Lobi oluşturuldu. Arkadaşını davet et."]
    };

    rooms.set(code,room);
    socket.join(code);

    callback({ok:true,code});
    sendRoom(room);
  });

  socket.on("room:join", (data, callback) => {
    const code = String(data.code || "").toUpperCase();
    const room = rooms.get(code);

    if (!room)
      return callback({ok:false,error:"Oda bulunamadı."});

    if (room.players.length >= 2)
      return callback({ok:false,error:"Oda dolu."});

    if (room.phase !== "waiting")
      return callback({ok:false,error:"Oyun başlamış."});

    room.players.push({
      id:socket.id,
      name:(data.name || "Oyuncu 2").slice(0,18),
      champion:null,
      items:[]
    });

    socket.join(code);
    room.log.push("Arkadaşın lobiye katıldı.");

    callback({ok:true});
    sendRoom(room);
  });

  socket.on("champion:pick", (data, callback) => {
    const room = findRoom(socket.id);

    if (!room || room.phase !== "waiting")
      return callback({ok:false,error:"Karakter seçilemiyor."});

    const player = room.players.find(p => p.id === socket.id);
    const id = data.championId;

    if (!champions[id])
      return callback({ok:false,error:"Geçersiz karakter."});

    if (room.players.some(p =>
      p !== player && p.champion === id
    ))
      return callback({ok:false,error:"Bu karakter seçilmiş."});

    player.champion = id;
    room.log.push(`${player.name}, ${champions[id].name} seçti.`);

    if (
      room.players.length === 2 &&
      room.players.every(p => p.champion)
    ) {
      room.phase = "draft";
      room.turn = 0;
      room.log.push("Eşya seçimi başladı. İlk sıra oda sahibinde.");
    }

    callback({ok:true});
    sendRoom(room);
  });

  socket.on("item:pick", (data, callback) => {
    const room = findRoom(socket.id);

    if (!room || room.phase !== "draft")
      return callback({ok:false,error:"Eşya seçimi aktif değil."});

    const player = room.players[room.turn % 2];

    if (player.id !== socket.id)
      return callback({ok:false,error:"Sıra rakibinde."});

    if (player.items.length >= 3)
      return callback({ok:false,error:"Üç eşya hakkın doldu."});

    const item = items.find(i => i.id === data.itemId);

    if (!item)
      return callback({ok:false,error:"Geçersiz eşya."});

    player.items.push(item.id);
    room.log.push(`${player.name}, ${item.name} aldı.`);

    room.turn++;

    const total = room.players.reduce(
      (sum,p) => sum + p.items.length,0
    );

    if (total >= 6) {
      room.battle = fight(room);
      room.winner = room.battle.winner;
      room.phase = "finished";
      room.log.push("Düello tamamlandı!");
    }

    callback({ok:true});
    sendRoom(room);
  });

  socket.on("disconnect", () => {
    const room = findRoom(socket.id);

    if (room) {
      room.log.push("Bir oyuncunun bağlantısı kesildi.");
      sendRoom(room);
    }
  });
});

function fight(room) {
  const fighters = room.players.map(player => {
    const base = champions[player.champion];

    const f = {
      name:player.name,
      champion:base.name,
      hp:base.hp,
      maxHp:base.hp,
      atk:base.atk,
      def:base.def,
      power:base.power,
      lifesteal:0,
      crit:0
    };

    for (const id of player.items) {
      const item = items.find(i => i.id === id);

      for (const [key,value] of Object.entries(item.stats)) {
        if (key === "hp") {
          f.hp += value;
          f.maxHp += value;
        } else if (key in f) {
          f[key] += value;
        }
      }
    }

    return f;
  });

  let turn = 0;
  const lines = [];

  while (
    fighters[0].hp > 0 &&
    fighters[1].hp > 0 &&
    turn < 30
  ) {
    const attacker = fighters[turn % 2];
    const defender = fighters[(turn + 1) % 2];

    const critical = Math.random() < attacker.crit / 100;

    const raw = attacker.atk + attacker.power * 0.45;

    const damage = Math.max(
      12,
      Math.round(
        raw * (critical ? 1.65 : 1) *
        (100 / (100 + defender.def))
      )
    );

    defender.hp = Math.max(0,defender.hp-damage);

    const heal = Math.round(
      damage * attacker.lifesteal / 100
    );

    attacker.hp = Math.min(
      attacker.maxHp,
      attacker.hp + heal
    );

    lines.push(
      `${attacker.name} (${attacker.champion}) ` +
      `${defender.name} oyuncusuna ${damage} hasar verdi.` +
      (critical ? " KRİTİK VURUŞ!" : "") +
      (heal ? ` ${heal} can kazandı.` : "")
    );

    turn++;
  }

  let winner = "Berabere";

  if (fighters[0].hp > fighters[1].hp)
    winner = fighters[0].name;

  if (fighters[1].hp > fighters[0].hp)
    winner = fighters[1].name;

  return {fighters,lines,winner};
}

app.get("/health",(req,res) => {
  res.json({ok:true});
});

server.listen(PORT,() => {
  console.log("LoL Duel çalışıyor: " + PORT);
});
                     
