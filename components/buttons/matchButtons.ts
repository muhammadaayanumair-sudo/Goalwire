import { ButtonInteraction } from "discord.js";
import type { GoalXClient } from "../../client/GoalXClient";
import type { ButtonComponent } from "../../types/discord";
import { User } from "../../database/models/User";
import { liveService } from "../../services/football/LiveService";
import { errorEmbed, successEmbed } from "../../utils/embeds";
import { CUSTOM_IDS } from "../../config/constants";
import { logger } from "../../utils/logger";

const MAX_FOLLOWED_FIXTURES = 20;

/**
 * customId format: "match_follow:<fixtureId>" — the fixture ID is embedded
 * directly in the button's customId since match embeds are stateless once
 * rendered (no separate lookup table mapping message -> fixture).
 */
async function handleFollow(client: GoalXClient, interaction: ButtonInteraction): Promise<void> {
  const [, fixtureIdRaw] = interaction.customId.split(":");
  const fixtureId = Number(fixtureIdRaw);

  if (!fixtureIdRaw || Number.isNaN(fixtureId)) {
    await interaction.reply({
      embeds: [errorEmbed("This follow button is malformed and can't be used.")],
      ephemeral: true,
    });
    return;
  }

  try {
    const user = await User.findOneAndUpdate(
      { discordId: interaction.user.id },
      {
        $setOnInsert: { discordId: interaction.user.id, username: interaction.user.username },
      },
      { upsert: true, new: true },
    );

    const isAlreadyFollowing = user.followedFixtures.includes(fixtureId);

    if (isAlreadyFollowing) {
      user.followedFixtures = user.followedFixtures.filter((id) => id !== fixtureId);
      await user.save();

      await interaction.reply({
        embeds: [successEmbed("You've unfollowed this match. No more notifications for it.")],
        ephemeral: true,
      });
      return;
    }

    if (user.followedFixtures.length >= MAX_FOLLOWED_FIXTURES) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            `You're already following the maximum of ${MAX_FOLLOWED_FIXTURES} matches. Unfollow one first.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const fixture = await liveService.getFixtureById(fixtureId);
    if (!fixture) {
      await interaction.reply({
        embeds: [errorEmbed("This match could not be found — it may have already finished.")],
        ephemeral: true,
      });
      return;
    }

    user.followedFixtures.push(fixtureId);
    await user.save();

    const dmWarning = !user.settings.dmAlerts
      ? "\n\n⚠️ You have DM alerts turned off, so you won't receive notifications until you enable them in `/settings`."
      : "";

    await interaction.reply({
      embeds: [
        successEmbed(
          `You're now following **${fixture.teams.home.name} vs ${fixture.teams.away.name}**. You'll get a DM on goals and full-time.${dmWarning}`,
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error handling match follow button", { error, userId: interaction.user.id, fixtureId });
    await interaction.reply({
      embeds: [errorEmbed("Failed to update your follow status. Please try again.")],
      ephemeral: true,
    });
  }
}

const matchButtons: ButtonComponent[] = [
  { customId: CUSTOM_IDS.MATCH.FOLLOW, execute: handleFollow },
];

export default matchButtons;
