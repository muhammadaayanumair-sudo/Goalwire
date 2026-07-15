import { Challenge, IChallenge, ChallengeStatus } from "../../database/models/Challenge";
import { FantasyTeam } from "../../database/models/FantasyTeam";
import { logger } from "../../utils/logger";

export class ChallengeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChallengeError";
  }
}

export class ChallengeService {
  public async createChallenge(
    guildId: string,
    proposerDiscordId: string,
    opponentDiscordId: string,
    gameweek: number,
  ): Promise<IChallenge> {
    if (proposerDiscordId === opponentDiscordId) {
      throw new ChallengeError("You can't challenge yourself.");
    }

    const [proposerTeam, opponentTeam] = await Promise.all([
      FantasyTeam.findOne({ discordId: proposerDiscordId, guildId }),
      FantasyTeam.findOne({ discordId: opponentDiscordId, guildId }),
    ]);

    if (!proposerTeam) {
      throw new ChallengeError("You need a fantasy team before challenging anyone. Use `/create` first.");
    }

    if (!opponentTeam) {
      throw new ChallengeError("That user doesn't have a fantasy team in this server yet.");
    }

    const existing = await Challenge.findOne({
      guildId,
      proposerDiscordId,
      opponentDiscordId,
      gameweek,
      status: { $in: ["pending", "accepted", "active"] },
    });

    if (existing) {
      throw new ChallengeError("You already have an open challenge against this user for this gameweek.");
    }

    try {
      const challenge = await Challenge.create({
        guildId,
        proposerDiscordId,
        proposerFantasyTeamId: proposerTeam._id,
        opponentDiscordId,
        gameweek,
        status: "pending",
      });

      logger.info("Challenge created", { guildId, proposerDiscordId, opponentDiscordId, gameweek });
      return challenge;
    } catch (error) {
      const isDuplicateKey = (error as { code?: number }).code === 11000;
      if (isDuplicateKey) {
        throw new ChallengeError("You already have an open challenge against this user for this gameweek.");
      }
      logger.error("Failed to create challenge", { error, guildId, proposerDiscordId, opponentDiscordId });
      throw new ChallengeError("Something went wrong creating that challenge.");
    }
  }

  public async acceptChallenge(challengeId: string, opponentDiscordId: string): Promise<IChallenge> {
    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      throw new ChallengeError("That challenge no longer exists.");
    }

    if (challenge.opponentDiscordId !== opponentDiscordId) {
      throw new ChallengeError("This challenge isn't addressed to you.");
    }

    if (challenge.status !== "pending") {
      throw new ChallengeError(`This challenge is already ${challenge.status} and can't be accepted.`);
    }

    const opponentTeam = await FantasyTeam.findOne({
      discordId: opponentDiscordId,
      guildId: challenge.guildId,
    });

    if (!opponentTeam) {
      throw new ChallengeError("You need a fantasy team before accepting a challenge. Use `/create` first.");
    }

    challenge.opponentFantasyTeamId = opponentTeam._id;
    challenge.status = "accepted";
    await challenge.save();

    logger.info("Challenge accepted", { challengeId, opponentDiscordId });
    return challenge;
  }

  public async declineChallenge(challengeId: string, opponentDiscordId: string): Promise<IChallenge> {
    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      throw new ChallengeError("That challenge no longer exists.");
    }

    if (challenge.opponentDiscordId !== opponentDiscordId) {
      throw new ChallengeError("This challenge isn't addressed to you.");
    }

    if (challenge.status !== "pending") {
      throw new ChallengeError(`This challenge is already ${challenge.status} and can't be declined.`);
    }

    challenge.status = "declined";
    await challenge.save();

    return challenge;
  }

  public async startChallenge(challengeId: string, requesterDiscordId: string): Promise<IChallenge> {
    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      throw new ChallengeError("That challenge no longer exists.");
    }

    const isParticipant =
      challenge.proposerDiscordId === requesterDiscordId || challenge.opponentDiscordId === requesterDiscordId;

    if (!isParticipant) {
      throw new ChallengeError("You're not part of this challenge.");
    }

    if (challenge.status !== "accepted") {
      if (challenge.status === "pending") {
        throw new ChallengeError("This challenge hasn't been accepted yet.");
      }
      throw new ChallengeError(`This challenge is already ${challenge.status} and can't be started.`);
    }

    challenge.status = "active";
    challenge.startedAt = new Date();
    await challenge.save();

    logger.info("Challenge started", { challengeId, requesterDiscordId });
    return challenge;
  }

  public async completeChallenge(challengeId: string): Promise<IChallenge> {
    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      throw new ChallengeError("That challenge no longer exists.");
    }

    if (challenge.status !== "active") {
      throw new ChallengeError("Only an active challenge can be completed.");
    }

    if (!challenge.opponentFantasyTeamId) {
      throw new ChallengeError("Challenge is missing an opponent team reference.");
    }

    const [proposerTeam, opponentTeam] = await Promise.all([
      FantasyTeam.findById(challenge.proposerFantasyTeamId),
      FantasyTeam.findById(challenge.opponentFantasyTeamId),
    ]);

    if (!proposerTeam || !opponentTeam) {
      throw new ChallengeError("Could not load one or both fantasy teams for this challenge.");
    }

    const proposerScore = proposerTeam.gameweekPoints;
    const opponentScore = opponentTeam.gameweekPoints;

    challenge.proposerScore = proposerScore;
    challenge.opponentScore = opponentScore;
    challenge.status = "completed";
    challenge.completedAt = new Date();
    challenge.winnerDiscordId =
      proposerScore === opponentScore
        ? undefined
        : proposerScore > opponentScore
          ? challenge.proposerDiscordId
          : challenge.opponentDiscordId;

    await challenge.save();

    logger.info("Challenge completed", { challengeId, proposerScore, opponentScore });
    return challenge;
  }

  public async getChallenge(challengeId: string): Promise<IChallenge | null> {
    return Challenge.findById(challengeId);
  }

  public async getPendingChallengesFor(discordId: string, guildId: string): Promise<IChallenge[]> {
    return Challenge.find({ opponentDiscordId: discordId, guildId, status: "pending" }).sort({ createdAt: -1 });
  }

  public async getActiveChallengesFor(discordId: string, guildId: string): Promise<IChallenge[]> {
    return Challenge.find({
      guildId,
      status: { $in: ["accepted", "active"] },
      $or: [{ proposerDiscordId: discordId }, { opponentDiscordId: discordId }],
    }).sort({ createdAt: -1 });
  }
}

export const challengeService = new ChallengeService();
