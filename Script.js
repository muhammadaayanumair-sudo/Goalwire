const API_KEY = "09fe9d7a670d45469626acb7e9368eb5";
const output = document.getElementById("output");

async function loadLive(){

  output.innerHTML = `
    <div class="card">⚽ Loading live matches...</div>
  `;

  try {
    const res = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers: { "x-apisports-key": API_KEY }
      }
    );

    const data = await res.json();

    let html = "<h2>🔴 LIVE NOW</h2>";

    if(!data.response.length){
      html += `<div class="card">No matches live right now</div>`;
    }

    data.response.slice(0,6).forEach(m => {
      html += `
        <div class="card">
          <b>${m.league.name}</b><br><br>
          ⚽ ${m.teams.home.name} <b>${m.goals.home}</b>
          - <b>${m.goals.away}</b> ${m.teams.away.name}<br><br>
          ⏱ ${m.fixture.status.elapsed || "0"} min
        </div>
      `;
    });

    output.innerHTML = html;

  } catch (e) {
    output.innerHTML = `
      <div class="card">
        ⚠️ Data temporarily unavailable<br>
        Try again in a few seconds
      </div>
    `;
  }
}

// smoother refresh (NOT spam)
loadLive();
setInterval(loadLive, 45000);
