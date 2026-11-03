const socket = io();

const $ = id => document.getElementById(id);

const champions = [
  ["zed","Zed","Suikastçı · Yüksek saldırı"],
  ["yasuo","Yasuo","Dövüşçü · Dengeli"],
  ["ahri","Ahri","Büyücü · Büyü gücü"],
  ["darius","Darius","Tank · Yüksek can"],
  ["lux","Lux","Büyücü · Yüksek büyü gücü"],
  ["jinx","Jinx","Nişancı · Yüksek saldırı"]
];

const items = [
  ["blade","⚔️ Saldırı Kılıcı","+18 Saldırı"],
  ["armor","🛡️ Zincir Yelek","+20 Savunma"],
  ["crystal","🔮 Büyü Kristali","+22 Büyü Gücü"],
  ["vamp","🩸 Yaşam Kılıcı","+10 Saldırı, +8 Can Çalma"],
  ["boots","👢 Gezgin Çizmesi","+8 Savunma"],
  ["heart","❤️ Dev Kemeri","+180 Can"],
  ["crit","💥 Keskin Kenar","+12 Saldırı, %15 Kritik"],
  ["ward","🧥 Direnç Pelerini","+14 Savunma, +60 Can"]
];

function playerName() {
  return $("playerName").value.trim() || "Oyuncu";
}

function showGame() {
  $("connect").classList.add("hidden");
  $("game").classList.remove("hidden");
}

function showMessage(text) {
  $("connectMsg").textContent = text;
}

$("createBtn").onclick = () => {
  socket.emit("room:create",
    {name:playerName()},
    result => {
      if (!result.ok) return showMessage(result.error);
      showGame();
      $("codeLabel").textContent = result.code;
    }
  );
};

$("joinBtn").onclick = () => {
  socket.emit("room:join", {
    name:playerName(),
    code:$("roomCode").value.trim()
  }, result => {
    if (!result.ok) return showMessage(result.error);
    showGame();
  });
};

$("copyBtn").onclick = async () => {
  try {
    await navigator.clipboard.writeText(
      $("codeLabel").textContent
    );
    $("copyBtn").textContent = "Kopyalandı!";
  } catch {
    showMessage("Oda kodunu elle kopyalayabilirsin.");
  }
};

$("restartBtn").onclick = () => location.reload();

function pickChampion(id) {
  socket.emit("champion:pick",
    {championId:id},
    result => {
      if (!result.ok) alert(result.error);
    }
  );
}

function pickItem(id) {
  socket.emit("item:pick",
    {itemId:id},
    result => {
      if (!result.ok) alert(result.error);
    }
  );
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  })[char]);
}

socket.on("room:update", room => {
  showGame();

  $("codeLabel").textContent = room.code;

  $("players").innerHTML = room.players.map(player => {
    const champion = champions.find(c =>
      c[0] === player.champion
    );

    return `
      <div class="player">
        <b>${escapeHTML(player.name)}</b>
        <span>
          ${champion ? champion[1] : "Şampiyon bekleniyor"}
          · ${player.items.length}/3 eşya
        </span>
      </div>
    `;
  }).join("");

  const myPlayer = room.players.find(p =>
    p.id === socket.id
  );

  const canChoose =
    room.phase === "waiting" &&
    room.players.length === 2 &&
    !myPlayer?.champion;

  $("championSection").classList.toggle(
    "hidden",
    !canChoose
  );

  $("champions").innerHTML = champions.map(c => {
    const taken = room.players.some(p =>
      p.champion === c[0]
    );

    return `
      <button class="choice"
        ${taken ? "disabled" : ""}
        onclick="pickChampion('${c[0]}')">
        <strong>${c[1]}</strong>
        <span>${c[2]}</span>
      </button>
    `;
  }).join("");

  $("itemSection").classList.toggle(
    "hidden",
    room.phase !== "draft"
  );

  if (room.phase === "draft") {
    const activePlayer =
      room.players[room.turn % 2];

    const myTurn =
      activePlayer.id === socket.id;

    $("turnLabel").textContent =
      myTurn ? "SENİN SIRAN" : "RAKİBİN SIRASI";

    $("itemCount").textContent =
      `Senin eşya sayın: ${myPlayer.items.length}/3`;

    $("items").innerHTML = items.map(item => `
      <button class="choice"
        ${!myTurn || myPlayer.items.length >= 3
          ? "disabled" : ""}
        onclick="pickItem('${item[0]}')">
        <strong>${item[1]}</strong>
        <span>${item[2]}</span>
      </button>
    `).join("");
  }

  $("battleSection").classList.toggle(
    "hidden",
    room.phase !== "finished"
  );

  if (room.phase === "finished" && room.battle) {
    $("battleSummary").innerHTML = `
      <div class="winner">
        ${room.winner === "Berabere"
          ? "BERABERE"
          : "🏆 KAZANAN: " + escapeHTML(room.winner)}
      </div>
    `;

    $("battleSummary").innerHTML +=
      room.battle.fighters.map(f => `
        <div class="fighter">
          <b>${escapeHTML(f.name)} · ${escapeHTML(f.champion)}</b>
          <div>${Math.max(0,f.hp)} / ${f.maxHp} can</div>
          <div class="bar">
            <i style="width:${
              Math.max(0,f.hp)/f.maxHp*100
            }%"></i>
          </div>
        </div>
      `).join("");

    $("battleLog").innerHTML =
      room.battle.lines.map(line => `
        <div class="fightline">
          ${escapeHTML(line)}
        </div>
      `).join("");
  }

  $("activity").innerHTML = room.log.map(line => `
    <div>${escapeHTML(line)}</div>
  `).join("");
});
