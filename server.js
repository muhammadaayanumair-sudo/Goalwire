const express = require("express");
const axios = require("axios");

const app = express();

const API_KEY = "09fe9d7a670d45469626acb7e9368eb5";

app.get("/live", async (req, res) => {
  try {
    const response = await axios.get(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers: {
          "x-apisports-key": API_KEY
        }
      }
    );

    res.json(response.data.response);
  } catch (err) {
    res.json([]);
  }
});

app.get("/", (req, res) => {
  res.send("⚽ GOALWIRE IS LIVE");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("GOALWIRE RUNNING");
});
