import { liveService } from "../services/football/LiveService";
import { Server } from "../database/models/Server";
import { User } from "../database/models/User";
import {
  goalEmbed,
  cardEmbed,
  substitutionEmbed,
  matchStatusEmbed,
} from "../utils/embeds";
import { logger } from "../utils/logger";
import type { GoalXClient } from "../client/GoalXClient";
import type { FootballFixture, FootballEvent } from "../types/football";
import type { EmbedBuilder } from "discord.js";

const BASE_INTERVAL_MS = 60000;
const MAX_INTERVAL_MS = 300000;
const IDLE_INTERVAL_MS = 180000;

function computePollInterval(liveFixtureCount: number): number {
  if (liveFixtureCount === 0) return IDLE_INTERVAL_MS;
  if (liveFixtureCount <= 2) return BASE_INTERVAL_MS;
  if (liveFixtureCount <= 5) return 120000;
  return MAX_INTERVAL_MS;
}

const seenEventKeys = new Map<number, Set<string>>();
const seenStatusKeys = new Map<number, Set<string>>();
const finishedFixtures = new Set<number>();

let isPolling = false;
let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

function eventKey(event: FootballEvent): string {
  return `${event.type}:${event.detail}:${event.time.elapsed}:${event.time.extra ?? 0}:${event.player.id}`;
}

export function startLiveUpdater(client: GoalXClient): void {
  if (isRunning) {
    logger.warn("Live updater already running, refusing to start a second instance");
    return;
  }

  isRunning = true;
  scheduleNextPoll(client, BASE_INTERVAL_MS);
  logger.info("Live updater started", { initialIntervalMs: BASE_INTERVAL_MS });
}

export function stopLiveUpdater(): void {
  isRunning = false;

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }

  logger.info("Live updater stopped");
}

function scheduleNextPoll(client: GoalXClient, delayMs: number): void {
  if (!isRunning) return;

  timeoutHandle = setTimeout(() => {
    void pollLiveFixtures(client);
  }, delayMs);
}

/**
 * DMs every user who follows this fixture and has dmAlerts enabled.
 * Failures per-user (DMs closed, blocked bot, etc.) are logged and skipped
 * individually so one blocked user doesn't stop the rest from being notified.
 */
async function notifyFollowers(client: GoalXClient, fixtureId: number, embed: EmbedBuilder): Promise<void> {
  try {
    const followers = await User.find({
      followedFixtures: fixtureId,
      "settings.dmAlerts": true,
    }).lean();

    if (followers.length === 0) return;

    for (const follower of followers) {
      try {
        const discordUser = await client.users.fetch(follower.discordId);
        await discordUser.send({ embeds: [embed] });
      } catch (error) {
        logger.warn("Failed to DM a fixture follower (likely DMs closed)", {
          error,
          discordId: follower.discordId,
          fixtureId,
        });
      }
    }
  } catch (error) {
    logger.error("Failed to query fixture followers", { error, fixtureId });
  }
}

async function pollLiveFixtures(client: GoalXClient): Promise<void> {
  if (isPolling) {
    logger.debug("Skipping live poll tick — previous tick still running");
    scheduleNextPoll(client, BASE_INTERVAL_MS);
    return;
  }

  isPolling = true;
  let nextInterval = IDLE_INTERVAL_MS;

  try {
    const fixtures = await liveService.getLiveFixtures();
    nextInterval = computePollInterval(fixtures.length);

    if (fixtures.length === 0) {
      return;
    }

    const servers = await Server.find({
      $or: [{ "channels.live": { $ne: null } }, { "channels.goals": { $ne: null } }],
    }).lean();

    for (const fixture of fixtures) {
      try {
        await processFixture(client, fixture, servers);
      } catch (error) {
        logger.error("Failed to process fixture during live poll", {
          error,
          fixtureId: fixture.id,
        });
      }
    }

    cleanupFinishedFixtures(fixtures);
  } catch (error) {
    logger.error("Live poll tick failed", { error });
  } finally {
    isPolling = false;
    scheduleNextPoll(client, nextInterval);
  }
}

async function processFixture(
  client: GoalXClient,
  fixture: FootballFixture,
  servers: { guildId: string; channels: { live?: string; goals?: string } }[],
): Promise<void> {
  if (finishedFixtures.has(fixture.id)) return;

  if (!seenEventKeys.has(fixture.id)) seenEventKeys.set(fixture.id, new Set());
  if (!seenStatusKeys.has(fixture.id)) seenStatusKeys.set(fixture.id, new Set());

  const eventSet = seenEventKeys.get(fixture.id)!;
  const statusSet = seenStatusKeys.get(fixture.id)!;

  await broadcastStatusChange(client, fixture, servers, statusSet);

  const events = await liveService.getFixtureEvents(fixture.id);
  const newEvents = events.filter((event) => !eventSet.has(eventKey(event)));

  for (const event of newEvents) {
    eventSet.add(eventKey(event));
    await broadcastEvent(client, fixture, event, servers);
  }

  if (fixture.status.short === "FT" || fixture.status.short === "AET" || fixture.status.short === "PEN") {
    finishedFixtures.add(fixture.id);
  }
}

async function broadcastStatusChange(
  client: GoalXClient,
  fixture: FootballFixture,
  servers: { guildId: string; channels: { live?: string; goals?: string } }[],
  statusSet: Set<string>,
): Promise<void> {
  const statusKey = fixture.status.short;

  const isKickoff = statusKey === "1H" && !statusSet.has("1H");
  const isHalftime = statusKey === "HT" && !statusSet.has("HT");
  const isFulltime = (statusKey === "FT" || statusKey === "AET" || statusKey === "PEN") && !statusSet.has(statusKey);

  if (!isKickoff && !isHalftime && !isFulltime) return;

  statusSet.add(statusKey);

  const status = isKickoff ? "kickoff" : isHalftime ? "halftime" : "fulltime";

  let goalScorers: { minute: string; player: string; team: string; assist?: string }[] | undefined;

  if (isFulltime) {
    try {
      const events = await liveService.getFixtureEvents(fixture.id);
      goalScorers = events
        .filter((e) => e.type === "Goal")
        .map((e) => ({
          minute: e.time.extra ? `${e.time.elapsed}+${e.time.extra}'` : `${e.time.elapsed}'`,
          player: e.player.name,
          team: e.team.name,
          assist: e.assist.name ?? undefined,
        }));
    } catch (error) {
      logger.warn("Failed to fetch goal scorers for full-time embed", { error, fixtureId: fixture.id });
    }
  }

  const embed = matchStatusEmbed({
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    homeScore: fixture.goals.home ?? 0,
    awayScore: fixture.goals.away ?? 0,
    competition: fixture.league.name,
    status,
    goalScorers,
    venue: fixture.venue.name,
  });

  for (const server of servers) {
    const channelId = server.channels.live;
    if (!channelId) continue;

    await sendToChannel(client, server.guildId, channelId, embed);
  }

  // Followers get kickoff/half-time/full-time DMs regardless of which servers
  // have a live channel configured — following is per-user, not per-server.
  await notifyFollowers(client, fixture.id, embed);
}

async function broadcastEvent(
  client: GoalXClient,
  fixture: FootballFixture,
  event: FootballEvent,
  servers: { guildId: string; channels: { live?: string; goals?: string } }[],
): Promise<void> {
  const minute = event.time.extra ? `${event.time.elapsed}+${event.time.extra}'` : `${event.time.elapsed}'`;

  const matchBase = {
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    homeScore: fixture.goals.home ?? 0,
    awayScore: fixture.goals.away ?? 0,
    competition: fixture.league.name,
  };

  if (event.type === "Goal" && event.detail !== "Missed Penalty") {
    const embed = goalEmbed({
      ...matchBase,
      scorerName: event.player.name,
      scorerTeam: event.team.name,
      minute,
      assistName: event.assist.name ?? undefined,
      isPenalty: event.detail.toLowerCase().includes("penalty"),
      isOwnGoal: event.detail.toLowerCase().includes("own"),
    });

    for (const server of servers) {
      const channelId = server.channels.goals ?? server.channels.live;
      if (!channelId) continue;
      await sendToChannel(client, server.guildId, channelId, embed);
    }

    await notifyFollowers(client, fixture.id, embed);
    return;
  }

  if (event.type === "Card") {
    const cardType = event.detail.toLowerCase().includes("second yellow")
      ? "second_yellow"
      : event.detail.toLowerCase().includes("yellow")
        ? "yellow"
        : "red";

    const embed = cardEmbed({
      ...matchBase,
      playerName: event.player.name,
      playerTeam: event.team.name,
      minute,
      cardType,
    });

    for (const server of servers) {
      const channelId = server.channels.live;
      if (!channelId) continue;
      await sendToChannel(client, server.guildId, channelId, embed);
    }
    return;
  }

  if (event.type === "subst") {
    const embed = substitutionEmbed({
      ...matchBase,
      playerOut: event.assist.name ?? "Unknown",
      playerIn: event.player.name,
