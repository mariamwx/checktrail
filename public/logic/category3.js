/* Category 3 — Feud
   UI: /public/ui/category3/
   Schema: category_three
   Multiple-choice answers from Classic / Funny decks.
   Players answer at their own pace. Tallies are anonymous.
   Winner = most majority answers across the round.
*/

(() => {
  "use strict";

  const SUPABASE_URL = window.SUPABASE_CONFIG?.url || "";
  const SUPABASE_KEY = window.SUPABASE_CONFIG?.publishableKey || "";
  const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: "category_three" },
  });
  const db = () => supabase.schema("category_three");

  const QUESTIONS_PER_PLAYER = 5;

  function roundSize(playerCount = players.length) {
    const n = Math.max(2, Number(playerCount) || 2);
    return n * QUESTIONS_PER_PLAYER;
  }

  const $ = (s, r = document) => r.querySelector(s);

  const screens = {
    home: $("#screen-home"),
    lobby: $("#screen-lobby"),
    play: $("#screen-play"),
    wait: $("#screen-wait"),
    results: $("#screen-results"),
  };

  const els = {
    homeForm: $("#home-form"),
    playerName: $("#player-name"),
    roomCode: $("#room-code"),
    btnCreate: $("#btn-create"),
    btnJoin: $("#btn-join"),
    homeError: $("#home-error"),
    lobbyCode: $("#lobby-code"),
    btnCopy: $("#btn-copy"),
    playerList: $("#player-list"),
    lobbyStatus: $("#lobby-status"),
    btnStart: $("#btn-start"),
    lobbyHint: $("#lobby-hint"),
    deckPicker: $("#deck-picker"),
    deckClassic: $("#deck-classic"),
    deckFunny: $("#deck-funny"),
    deckBadge: $("#deck-badge"),
    progressChip: $("#progress-chip"),
    themeChip: $("#theme-chip"),
    questionText: $("#question-text"),
    choiceGrid: $("#choice-grid"),
    waitCopy: $("#wait-copy"),
    waitStat: $("#wait-stat"),
    charts: $("#charts"),
    winnerBoard: $("#winner-board"),
    toast: $("#toast"),
  };

  let me = { id: null, name: "", isHost: false };
  let roomCode = null;
  let channel = null;
  let players = [];
  let bank = [];
  let playQuestions = [];
  let questionIds = [];
  let roomDeckVersion = "classic";
  let myIndex = 0;
  let myVotes = {};
  let phase = "home";
  let toastTimer = null;
  let votingLock = false;
  let waitPollTimer = null;

  function sessionKey(code) {
    return `c3-session-${String(code || "").toUpperCase()}`;
  }
  function saveSession() {
    if (!roomCode || !me?.id) return;
    try {
      localStorage.setItem(
        sessionKey(roomCode),
        JSON.stringify({
          id: me.id,
          name: me.name,
          isHost: me.isHost,
          roomCode,
          myVotes,
          myIndex,
        })
      );
    } catch (_) {}
  }
  function loadSession(code) {
    try {
      const raw = localStorage.getItem(sessionKey(code));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }
  function clearSession(code) {
    try {
      localStorage.removeItem(sessionKey(code));
    } catch (_) {}
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function makeRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars[(Math.random() * chars.length) | 0];
    return out;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2400);
  }

  function setError(msg) {
    els.homeError.hidden = !msg;
    els.homeError.textContent = msg || "";
  }

  function inviteUrl(code) {
    const url = new URL(location.href);
    url.searchParams.set("room", code);
    url.searchParams.delete("host");
    return url.toString();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function deckLabel(version = roomDeckVersion) {
    return version === "funny" ? "Funny" : "Classic";
  }

  async function loadQuestionBank(version = roomDeckVersion) {
    const deck = version === "funny" ? "funny" : "classic";
    const { data, error } = await db()
      .from("question_bank")
      .select("*")
      .eq("version", deck)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    bank = data || [];
    roomDeckVersion = deck;
    if (!bank.length) {
      throw new Error(
        `No ${deck} Feud questions found. Expose schema category_three in Supabase API settings and seed the bank.`
      );
    }
  }

  function setPlayQuestionsFromIds(ids) {
    questionIds = Array.isArray(ids) ? ids.map(String) : [];
    const byId = Object.fromEntries(bank.map((q) => [q.id, q]));
    playQuestions = questionIds.map((id) => byId[id]).filter(Boolean);
  }

  function pickRoundIds() {
    const pool = shuffle(bank.map((q) => q.id));
    const want = roundSize(players.length);
    return pool.slice(0, Math.min(want, pool.length));
  }

  async function setDeckVersion(version) {
    if (!me.isHost || phase !== "lobby" || !roomCode) return;
    const deck = version === "funny" ? "funny" : "classic";
    if (deck === roomDeckVersion && bank.length) {
      renderLobby();
      return;
    }
    await loadQuestionBank(deck);
    const { error } = await db()
      .from("rooms")
      .update({
        deck_version: deck,
        question_count: roundSize(players.length),
        updated_at: new Date().toISOString(),
      })
      .eq("code", roomCode);
    if (error) throw new Error(error.message);
    renderLobby();
    toast(`${deckLabel(deck)} deck selected`);
  }

  async function refreshPlayers(opts = {}) {
    const { data, error } = await db()
      .from("players")
      .select("*")
      .eq("room_id", roomCode)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    players = data || [];
    renderLobby();
    if (!opts.silent && (phase === "playing" || phase === "wait")) {
      await syncProgress().catch(console.error);
    }
  }

  async function refreshRoom() {
    const { data, error } = await db()
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return;

    const nextDeck = data.deck_version === "funny" ? "funny" : "classic";
    if (data.phase === "lobby" && nextDeck !== roomDeckVersion) {
      await loadQuestionBank(nextDeck);
      renderLobby();
    }

    if (data.phase === "playing" && phase === "lobby") {
      if (nextDeck !== roomDeckVersion) await loadQuestionBank(nextDeck);
      setPlayQuestionsFromIds(data.question_ids || []);
      phase = "playing";
      await beginPlaying();
    } else if (data.phase === "playing" && (phase === "playing" || phase === "wait")) {
      if (nextDeck !== roomDeckVersion) await loadQuestionBank(nextDeck);
      setPlayQuestionsFromIds(data.question_ids || []);
      await syncProgress().catch(console.error);
    } else if (data.phase === "results") {
      if (nextDeck !== roomDeckVersion) await loadQuestionBank(nextDeck);
      setPlayQuestionsFromIds(data.question_ids || []);
      phase = "results";
      await showResults();
    }
  }

  async function subscribe() {
    if (channel) supabase.removeChannel(channel);
    channel = supabase
      .channel(`c3:${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "category_three", table: "players", filter: `room_id=eq.${roomCode}` },
        () => refreshPlayers().catch(console.error)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "category_three", table: "rooms", filter: `code=eq.${roomCode}` },
        () => refreshRoom().catch(console.error)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "category_three", table: "votes", filter: `room_id=eq.${roomCode}` },
        () => syncProgress().catch(console.error)
      )
      .subscribe();
  }

  function renderLobby() {
    els.lobbyCode.textContent = roomCode;
    els.playerList.innerHTML = "";
    players.forEach((p) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(p.name)}</span><span>${
        p.id === me.id ? "you" : p.is_host ? "host" : "joined"
      }</span>`;
      els.playerList.appendChild(li);
    });
    const ready = players.length >= 2;
    els.lobbyStatus.textContent = `${players.length} player${
      players.length === 1 ? "" : "s"
    } · ${deckLabel()} deck · ${roundSize(players.length)} Qs`;
    els.lobbyHint.textContent = ready
      ? me.isHost
        ? `Pick a deck, then start (${QUESTIONS_PER_PLAYER} questions per player).`
        : "Waiting for the host to start."
      : "Need at least 2 players.";
    els.btnStart.hidden = !me.isHost;
    els.btnStart.disabled = !ready;

    if (els.deckPicker) {
      els.deckPicker.hidden = !me.isHost;
      els.deckClassic?.classList.toggle("is-selected", roomDeckVersion === "classic");
      els.deckFunny?.classList.toggle("is-selected", roomDeckVersion === "funny");
    }
    if (els.deckBadge) {
      els.deckBadge.hidden = !!me.isHost;
      els.deckBadge.innerHTML = me.isHost
        ? ""
        : `Deck: <strong>${escapeHtml(deckLabel())}</strong>`;
    }
  }

  async function createRoom(name) {
    await loadQuestionBank("classic");
    const code = makeRoomCode();
    me = { id: uid(), name, isHost: true };
    roomCode = code;

    const { error: roomErr } = await db().from("rooms").insert({
      code,
      host_id: me.id,
      phase: "lobby",
      question_count: roundSize(1),
      deck_version: "classic",
      question_ids: [],
    });
    if (roomErr) throw new Error(roomErr.message);

    const { error: playerErr } = await db().from("players").insert({
      id: me.id,
      room_id: code,
      name,
      is_host: true,
    });
    if (playerErr) throw new Error(playerErr.message);

    history.replaceState(null, "", inviteUrl(code));
    await subscribe();
    await refreshPlayers();
    phase = "lobby";
    show("lobby");
    saveSession();
    toast(`Room ${code} ready`);
  }

  async function joinRoom(name, code) {
    code = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (code.length < 4) throw new Error("Enter a valid room code.");
    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("Enter a name.");

    const { data: room, error: roomErr } = await db()
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (roomErr) throw new Error(roomErr.message);
    if (!room) throw new Error("Room not found.");
    if (room.phase !== "lobby") throw new Error("This room already started.");

    await loadQuestionBank(room.deck_version === "funny" ? "funny" : "classic");

    const { data: existing, error: existingErr } = await db()
      .from("players")
      .select("id, name")
      .eq("room_id", code);
    if (existingErr) throw new Error(existingErr.message);
    if ((existing || []).some((p) => p.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error("That name is already taken in this room. Pick another.");
    }

    me = { id: uid(), name: cleanName, isHost: false };
    roomCode = code;

    const { error: playerErr } = await db().from("players").insert({
      id: me.id,
      room_id: code,
      name: cleanName,
      is_host: false,
    });
    if (playerErr) throw new Error(playerErr.message);

    history.replaceState(null, "", inviteUrl(code));
    await subscribe();
    await refreshPlayers();
    phase = "lobby";
    show("lobby");
    saveSession();
  }

  async function resumeRoom(code) {
    const session = loadSession(code);
    if (!session?.id) return false;

    const { data: room, error: roomErr } = await db()
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (roomErr || !room) {
      clearSession(code);
      return false;
    }

    await loadQuestionBank(room.deck_version === "funny" ? "funny" : "classic");
    setPlayQuestionsFromIds(room.question_ids || []);

    const { data: player } = await db()
      .from("players")
      .select("*")
      .eq("room_id", code)
      .eq("id", session.id)
      .maybeSingle();
    if (!player) {
      clearSession(code);
      return false;
    }

    me = {
      id: player.id,
      name: player.name,
      isHost: !!player.is_host || !!session.isHost,
    };
    roomCode = code;
    myVotes = session.myVotes && typeof session.myVotes === "object" ? session.myVotes : {};
    myIndex = Number.isFinite(session.myIndex) ? session.myIndex : 0;
    history.replaceState(null, "", inviteUrl(code));
    await subscribe();
    await refreshPlayers({ silent: true });
    saveSession();

    if (room.phase === "lobby") {
      phase = "lobby";
      show("lobby");
    } else if (room.phase === "playing") {
      phase = "playing";
      await beginPlaying();
    } else if (room.phase === "results") {
      phase = "results";
      await showResults();
    } else {
      phase = "lobby";
      show("lobby");
    }
    toast(`Welcome back, ${me.name}`);
    return true;
  }

  async function startGame() {
    if (!me.isHost) return;
    await loadQuestionBank(roomDeckVersion);
    await refreshPlayers({ silent: true });
    const ids = pickRoundIds();
    if (!ids.length) throw new Error("No questions available for this deck.");

    const { error } = await db()
      .from("rooms")
      .update({
        phase: "playing",
        deck_version: roomDeckVersion,
        question_count: ids.length,
        question_ids: ids,
        updated_at: new Date().toISOString(),
      })
      .eq("code", roomCode);
    if (error) throw new Error(error.message);

    setPlayQuestionsFromIds(ids);
    myVotes = {};
    myIndex = 0;
    phase = "playing";
    await beginPlaying();
  }

  async function beginPlaying() {
    stopWaitPoll();
    if (!playQuestions.length) {
      const { data: room } = await db()
        .from("rooms")
        .select("question_ids")
        .eq("code", roomCode)
        .maybeSingle();
      setPlayQuestionsFromIds(room?.question_ids || []);
    }
    await hydrateMyVotes();
    await syncProgress();
  }

  async function hydrateMyVotes() {
    const { data, error } = await db()
      .from("votes")
      .select("question_id, choice_index")
      .eq("room_id", roomCode)
      .eq("voter_id", me.id);
    if (error) throw new Error(error.message);
    myVotes = {};
    (data || []).forEach((v) => {
      myVotes[v.question_id] = v.choice_index;
    });
    myIndex = 0;
    while (myIndex < questionIds.length && myVotes[questionIds[myIndex]] != null) {
      myIndex += 1;
    }
    saveSession();
  }

  async function fetchRoomVotes() {
    const { data, error } = await db()
      .from("votes")
      .select("question_id, voter_id, choice_index")
      .eq("room_id", roomCode);
    if (error) throw new Error(error.message);
    return data || [];
  }

  function finishedCount(votes) {
    const needed = questionIds.length;
    if (!needed) return 0;
    const byVoter = {};
    votes.forEach((v) => {
      if (!questionIds.includes(v.question_id)) return;
      byVoter[v.voter_id] = (byVoter[v.voter_id] || 0) + 1;
    });
    return players.filter((p) => (byVoter[p.id] || 0) >= needed).length;
  }

  async function syncProgress() {
    if (!roomCode || !questionIds.length || !players.length) return;
    const votes = await fetchRoomVotes();
    myVotes = {};
    votes.forEach((v) => {
      if (v.voter_id === me.id) myVotes[v.question_id] = v.choice_index;
    });

    const done = finishedCount(votes) >= players.length;
    if (done) {
      stopWaitPoll();
      els.waitCopy.textContent = "Everyone finished — opening results…";
      els.waitStat.textContent = `${players.length} / ${players.length} finished`;
      if (me.isHost) {
        await db()
          .from("rooms")
          .update({ phase: "results", updated_at: new Date().toISOString() })
          .eq("code", roomCode);
      }
      phase = "results";
      await showResults();
      return;
    }

    while (myIndex < questionIds.length && myVotes[questionIds[myIndex]] != null) {
      myIndex += 1;
    }

    if (myIndex >= questionIds.length) {
      phase = "wait";
      const waitingOn = players.filter((p) => {
        const n = votes.filter(
          (v) => v.voter_id === p.id && questionIds.includes(v.question_id)
        ).length;
        return n < questionIds.length;
      });
      els.waitCopy.textContent = waitingOn.length
        ? `Waiting for ${waitingOn.map((p) => p.name).join(", ")}…`
        : "Almost there…";
      els.waitStat.textContent = `${finishedCount(votes)} / ${players.length} finished`;
      show("wait");
      startWaitPoll();
      return;
    }

    stopWaitPoll();
    phase = "playing";
    votingLock = false;
    renderQuestion();
    show("play");
  }

  function renderQuestion() {
    const q = playQuestions[myIndex];
    if (!q) {
      syncProgress().catch(console.error);
      return;
    }
    els.progressChip.textContent = `${myIndex + 1} / ${playQuestions.length}`;
    if (els.themeChip) els.themeChip.textContent = q.theme || "Feud";
    els.questionText.textContent = q.prompt;
    els.choiceGrid.innerHTML = "";
    votingLock = false;
    const answers = Array.isArray(q.answers) ? q.answers : [];
    answers.forEach((label, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.innerHTML = `<span class="choice-letter">${String.fromCharCode(65 + idx)}</span><span class="choice-text">${escapeHtml(
        label
      )}</span>`;
      btn.onclick = () => castVote(q.id, idx, btn);
      els.choiceGrid.appendChild(btn);
    });
  }

  async function castVote(questionId, choiceIndex, btn) {
    if (votingLock) return;
    if (myVotes[questionId] != null) return;
    votingLock = true;

    [...els.choiceGrid.querySelectorAll(".choice")].forEach((b) => {
      b.disabled = true;
      b.classList.remove("selected");
    });
    btn.classList.add("selected");

    const { error } = await db().from("votes").upsert(
      {
        room_id: roomCode,
        question_id: questionId,
        voter_id: me.id,
        choice_index: choiceIndex,
      },
      { onConflict: "room_id,question_id,voter_id" }
    );
    if (error) {
      toast(error.message || "Vote failed — try again");
      votingLock = false;
      [...els.choiceGrid.querySelectorAll(".choice")].forEach((b) => {
        b.disabled = false;
        b.classList.remove("selected");
      });
      return;
    }

    myVotes[questionId] = choiceIndex;
    myIndex += 1;
    saveSession();
    await syncProgress();
  }

  function stopWaitPoll() {
    if (waitPollTimer) {
      clearInterval(waitPollTimer);
      waitPollTimer = null;
    }
  }

  function startWaitPoll() {
    stopWaitPoll();
    waitPollTimer = setInterval(() => {
      syncProgress().catch(console.error);
    }, 1500);
  }

  function majorityIndexes(counts) {
    const max = Math.max(...counts, 0);
    if (max <= 0) return [];
    return counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
  }

  function scorePlayers(votes) {
    const scores = Object.fromEntries(players.map((p) => [p.id, 0]));
    playQuestions.forEach((q) => {
      const counts = [0, 0, 0, 0];
      const qVotes = votes.filter((v) => v.question_id === q.id);
      qVotes.forEach((v) => {
        if (v.choice_index >= 0 && v.choice_index <= 3) counts[v.choice_index] += 1;
      });
      const winners = majorityIndexes(counts);
      if (!winners.length) return;
      qVotes.forEach((v) => {
        if (winners.includes(v.choice_index) && scores[v.voter_id] != null) {
          scores[v.voter_id] += 1;
        }
      });
    });
    return scores;
  }

  async function showResults() {
    stopWaitPoll();
    show("results");
    const votes = await fetchRoomVotes();

    const scores = scorePlayers(votes);
    const ranked = [...players]
      .map((p) => ({ ...p, score: scores[p.id] || 0 }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const top = ranked[0]?.score ?? 0;
    const winners = ranked.filter((p) => p.score === top && top > 0);

    if (els.winnerBoard) {
      els.winnerBoard.innerHTML = "";
      const title = document.createElement("h2");
      title.className = "section-title";
      if (!winners.length) {
        title.textContent = "No clear majority champ yet";
      } else if (winners.length === 1) {
        title.textContent = `${winners[0].name} wins`;
      } else {
        title.textContent = `Tie: ${winners.map((w) => w.name).join(" & ")}`;
      }
      els.winnerBoard.appendChild(title);

      const sub = document.createElement("p");
      sub.className = "sub";
      sub.textContent = "Score = how many times you matched the room’s top answer.";
      els.winnerBoard.appendChild(sub);

      const list = document.createElement("ul");
      list.className = "score-list";
      ranked.forEach((p, i) => {
        const li = document.createElement("li");
        li.className = winners.some((w) => w.id === p.id) ? "is-winner" : "";
        li.innerHTML = `<span class="score-rank">${i + 1}</span><span class="score-name">${escapeHtml(
          p.name
        )}${p.id === me.id ? " (you)" : ""}</span><span class="score-pts">${p.score} / ${
          playQuestions.length
        }</span>`;
        list.appendChild(li);
      });
      els.winnerBoard.appendChild(list);
    }

    els.charts.innerHTML = "";
    playQuestions.forEach((q) => {
      const counts = [0, 0, 0, 0];
      votes
        .filter((v) => v.question_id === q.id)
        .forEach((v) => {
          if (v.choice_index >= 0 && v.choice_index <= 3) counts[v.choice_index] += 1;
        });
      const winnersIdx = majorityIndexes(counts);
      const answers = Array.isArray(q.answers) ? q.answers : [];

      const card = document.createElement("article");
      card.className = "chart-card";
      card.innerHTML = `<p class="chart-theme">${escapeHtml(q.theme || "")}</p><h3>${escapeHtml(
        q.prompt
      )}</h3><div class="chart-canvas-wrap"></div><ul class="tally-list"></ul>`;
      const tally = card.querySelector(".tally-list");
      answers.forEach((label, idx) => {
        const li = document.createElement("li");
        if (winnersIdx.includes(idx)) li.classList.add("is-majority");
        li.innerHTML = `<span class="tally-letter">${String.fromCharCode(65 + idx)}</span><span class="tally-label">${escapeHtml(
          label
        )}</span><span class="tally-count">${counts[idx]}</span>`;
        tally.appendChild(li);
      });
      const wrap = card.querySelector(".chart-canvas-wrap");
      const canvas = document.createElement("canvas");
      wrap.appendChild(canvas);
      els.charts.appendChild(card);
      drawBarChart(
        canvas,
        answers.map((label, idx) => ({
          name: String.fromCharCode(65 + idx),
          value: counts[idx],
          highlight: winnersIdx.includes(idx),
        }))
      );
    });
  }

  function drawBarChart(canvas, series) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.min(640, canvas.parentElement.clientWidth || 640);
    const cssH = 220;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const padL = 36;
    const padR = 12;
    const padT = 16;
    const padB = 42;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    const maxVal = Math.max(8, ...series.map((s) => s.value), 1);
    const yMax = Math.max(8, Math.ceil(maxVal / 2) * 2);
    const step = yMax <= 8 ? 2 : Math.ceil(yMax / 4);

    ctx.fillStyle = "#f7f5f1";
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.strokeStyle = "#d8d2c8";
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    ctx.fillStyle = "#6e6a64";
    ctx.font = "12px DM Sans, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = 0; y <= yMax; y += step) {
      const py = padT + plotH - (y / yMax) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(cssW - padR, py);
      ctx.stroke();
      ctx.fillText(String(y), padL - 8, py);
    }
    ctx.setLineDash([]);

    const n = Math.max(series.length, 1);
    const gap = 18;
    const barW = Math.min(70, (plotW - gap * (n + 1)) / n);

    series.forEach((s, i) => {
      const x = padL + gap + i * (barW + gap) + (plotW - gap * (n + 1) - barW * n) / 2;
      const h = (s.value / yMax) * plotH;
      const y = padT + plotH - h;
      const r = 10;

      ctx.fillStyle = s.highlight ? "#2f4f9b" : "#9aa3ad";
      roundTopRect(ctx, x, y, barW, h, r);
      ctx.fill();

      ctx.fillStyle = "#1c1b19";
      ctx.font = "13px Syne, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(s.name, x + barW / 2, padT + plotH + 10);
    });
  }

  function roundTopRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h);
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  let inviteMode = false;

  function enableInviteHome(code) {
    inviteMode = true;
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    els.roomCode.value = normalized;

    const home = document.getElementById("screen-home");
    const actions = document.querySelector("#screen-home .actions");
    if (!home || !actions) return;

    home.classList.add("invite-receiver-mode");
    els.btnCreate.hidden = true;
    els.btnCreate.style.display = "none";
    const joinRow = actions.querySelector(".join-row");
    if (joinRow) {
      joinRow.hidden = true;
      joinRow.style.display = "none";
    }

    let inviteBlock = document.getElementById("invite-join-block");
    if (!inviteBlock) {
      inviteBlock = document.createElement("div");
      inviteBlock.id = "invite-join-block";
      inviteBlock.className = "invite-join-block";
      inviteBlock.innerHTML = `
        <p class="invite-room-label">Joining room <strong id="invite-room-label">${normalized}</strong></p>
        <button type="button" class="btn btn-primary btn-lg" id="btn-invite-join">Join group</button>
        <button type="button" class="invite-own-group" id="btn-start-own-group">start your own group</button>
      `;
      actions.appendChild(inviteBlock);
      $("#btn-invite-join").onclick = () => els.btnJoin.click();
      $("#btn-start-own-group").onclick = () => {
        location.href = "/";
      };
    } else {
      const label = $("#invite-room-label");
      if (label) label.textContent = normalized;
      inviteBlock.hidden = false;
    }
  }

  els.homeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");
    const name = els.playerName.value.trim();
    if (!name) return;

    if (inviteMode) {
      els.btnJoin.click();
      return;
    }

    els.btnCreate.disabled = true;
    try {
      await createRoom(name);
    } catch (err) {
      setError(err.message || "Could not create room.");
    } finally {
      els.btnCreate.disabled = false;
    }
  });

  els.btnJoin.addEventListener("click", async () => {
    setError("");
    const name = els.playerName.value.trim();
    const code = els.roomCode.value.trim();
    if (!name) {
      setError("Add your name first.");
      return;
    }
    els.btnJoin.disabled = true;
    const inviteBtn = $("#btn-invite-join");
    if (inviteBtn) inviteBtn.disabled = true;
    try {
      await joinRoom(name, code);
    } catch (err) {
      setError(err.message || "Could not join.");
    } finally {
      els.btnJoin.disabled = false;
      if (inviteBtn) inviteBtn.disabled = false;
    }
  });

  els.btnCopy.addEventListener("click", async () => {
    const url = inviteUrl(roomCode);
    try {
      await navigator.clipboard.writeText(url);
      toast("Invite link copied");
    } catch (_) {
      toast(url);
    }
  });

  els.btnStart.addEventListener("click", async () => {
    try {
      await startGame();
    } catch (err) {
      toast(err.message || "Could not start");
    }
  });

  els.deckClassic?.addEventListener("click", async () => {
    try {
      await setDeckVersion("classic");
    } catch (err) {
      toast(err.message || "Could not switch deck");
    }
  });
  els.deckFunny?.addEventListener("click", async () => {
    try {
      await setDeckVersion("funny");
    } catch (err) {
      toast(err.message || "Could not switch deck");
    }
  });

  const params = new URLSearchParams(location.search);
  const preset = params.get("room");
  (async () => {
    if (preset) {
      const resumed = await resumeRoom(preset.toUpperCase());
      if (!resumed) enableInviteHome(preset);
    } else if (params.get("host") !== "1") {
      location.replace("/");
    }
  })().catch(console.error);
})();
