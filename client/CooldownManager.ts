import { Collection } from "discord.js";
import { COOLDOWNS } from "../config/constants";

export class CooldownManager {
  private cooldowns: Collection<string, Collection<string, number>> = new Collection();

  public checkCooldown(
    commandName: string,
    userId: string,
    cooldownSeconds: number = COOLDOWNS.DEFAULT,
  ): { onCooldown: boolean; timeLeft: number } {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }

    const now = Date.now();
    const timestamps = this.cooldowns.get(commandName)!;
    const cooldownAmount = cooldownSeconds * 1000;

    const expirationTime = timestamps.get(userId);

    if (expirationTime && now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return { onCooldown: true, timeLeft };
    }

    timestamps.set(userId, now + cooldownAmount);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);

    return { onCooldown: false, timeLeft: 0 };
  }

  public resetCooldown(commandName: string, userId: string): void {
    this.cooldowns.get(commandName)?.delete(userId);
  }

  public getRemainingCooldown(commandName: string, userId: string): number {
    const expirationTime = this.cooldowns.get(commandName)?.get(userId);
    if (!expirationTime) return 0;

    const timeLeft = (expirationTime - Date.now()) / 1000;
    return timeLeft > 0 ? timeLeft : 0;
  }
}
