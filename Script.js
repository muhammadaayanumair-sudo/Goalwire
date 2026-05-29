const API_KEY = "09fe9d7a670d45469626acb7e9368eb5";

const output = document.getElementById("output");

// 🔴 AUTO REFRESH (REAL TIME FEEL)
setInterval(() => {
  loadLive();
}, 30000);

// ================= LIVE =================
async function loadLive(){

  const res = await fetch(
    "https://v3.football.api-sports.io/fixtures?live=all",
    {
      headers: { "x-apisports-key": API_KEY }
    }
  );

  const data = await res.json();

  let html = "<h2>🔴 LIVE MATCHES</h2>";

  data.response.slice(0,10).forEach(m => {
    html += `
      <div class="card">
        <b>${m.league.name}</b><br>
        ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}<br>
        ⏱ ${m.fixture.status.elapsed}'
        <div class="live">LIVE</div>
      </div>
    `;
  });

  output.innerHTML = html;
}

// ================= PREMIER LEAGUE =================
async function loadPL(){

  const res = await fetch(
    "https://v3.football.api-sports.io/fixtures?league=39&season=2025",
    { headers: { "x-apisports-key": API_KEY } }
  );

  const data = await res.json();

  let html = "<h2>🏆 Premier League</h2>";

  data.response.slice(0,10).forEach(m => {
    html += `
      <div class="card">
        ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}
      </div>
    `;
  });

  output.innerHTML = html;
}

// ================= UCL =================
async function loadUCL(){

  const res = await fetch(
    "https://v3.football.api-sports.io/fixtures?league=2&season=2025",
    { headers: { "x-apisports-key": API_KEY } }
  );

  const data = await res.json();

  let html = "<h2>🏆 Champions League</h2>";

  data.response.slice(0,10).forEach(m => {
    html += `
      <div class="card">
        ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}
      </div>
    `;
  });

  output.innerHTML = html;
}

// ================= TOP SCORERS =================
async function loadScorers(){

  const res = await fetch(
    "https://v3.football.api-sports.io/players/topscorers?league=39&season=2025",
    { headers: { "x-apisports-key": API_KEY } }
  );

  const data = await res.json();

  let html = "<h2>⚽ Top Scorers</h2>";

  data.response.slice(0,10).forEach(p => {
    html += `
      <div class="card">
        ${p.player.name} — ${p.statistics[0].goals.total} goals
      </div>
    `;
  });

  output.innerHTML = html;
}
