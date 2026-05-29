const API_KEY = "09fe9d7a670d45469626acb7e9368eb5";

const output = document.getElementById("output");
const status = document.getElementById("status");
const searchBox = document.getElementById("searchBox");

let auto = true;

// status helper
function updateStatus(text){
  status.innerHTML = `${text} • ${new Date().toLocaleTimeString()}`;
}

// 🔴 LIVE MATCHES
async function loadLive(){
  updateStatus("Loading live matches...");

  const res = await fetch(
    "https://v3.football.api-sports.io/fixtures?live=all",
    { headers: { "x-apisports-key": API_KEY } }
  );

  const data = await res.json();

  let html = `<h2>🔴 LIVE <span class="badge">${data.response.length}</span></h2>`;

  data.response.slice(0,8).forEach(m => {
    html += `
      <div class="card">
        <b>${m.league.name}</b><br><br>
        ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}<br>
        ⏱ ${m.fixture.status.elapsed || 0}'
      </div>
    `;
  });

  output.innerHTML = html;
  updateStatus("Live updated");
}

// 📅 UPCOMING MATCHES
async function loadUpcoming(){
  updateStatus("Loading upcoming...");

  const res = await fetch(
    "https://v3.football.api-sports.io/fixtures?next=10",
    { headers: { "x-apisports-key": API_KEY } }
  );

  const data = await res.json();

  let html = "<h2>📅 Upcoming Matches</h2>";

  data.response.forEach(m => {
    html += `
      <div class="card">
        ${m.league.name}<br>
        ${m.teams.home.name} vs ${m.teams.away.name}<br>
        🕒 ${m.fixture.date}
      </div>
    `;
  });

  output.innerHTML = html;
}

// 🏆 LEAGUE
async function loadLeague(id){
  updateStatus("Loading league...");

  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=${id}&season=2025`,
    { headers: { "x-apisports-key": API_KEY } }
  );

  const data = await res.json();

  let html = "<h2>🏆 League</h2>";

  data.response.slice(0,10).forEach(m => {
    html += `
      <div class="card">
        ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}
      </div>
    `;
  });

  output.innerHTML = html;
}

// ⚽ TOP SCORERS
async function loadScorers(){
  updateStatus("Loading scorers...");

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

// 🔍 SEARCH TEAM
async function searchTeam(){
  const q = searchBox.value;
  if(q.length < 3) return;

  updateStatus("Searching team...");

  const res = await fetch(
    `https://v3.football.api-sports.io/teams?search=${q}`,
    { headers: { "x-apisports-key": API_KEY } }
  );

  const data = await res.json();

  let html = "<h2>🔍 Teams</h2>";

  data.response.forEach(t => {
    html += `
      <div class="card">
        ⚽ ${t.team.name}<br>
        📍 ${t.team.country}
      </div>
    `;
  });

  output.innerHTML = html;
}

// ⏱ AUTO TOGGLE
function toggleAuto(){
  auto = !auto;
  updateStatus(auto ? "Auto ON" : "Auto OFF");
}

// auto refresh
setInterval(() => {
  if(auto) loadLive();
}, 60000);

// start
loadLive();
