type LogLevel = "error" | "warn" | "info" | "debug";

interface LogMeta {
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  error: "\x1b[31m",
  warn: "\x1b[33m",
  info: "\x1b[36m",
  debug: "\x1b[90m",
};

const RESET_COLOR = "\x1b[0m";

class Logger {
  private currentLevel: LogLevel;

  constructor(level: LogLevel = "info") {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[this.currentLevel];
  }

  private formatMeta(meta?: LogMeta): string {
    if (!meta) return "";

    if (meta.error instanceof Error) {
      return `\n  ${meta.error.stack ?? meta.error.message}`;
    }

    try {
      return Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    } catch {
      return "";
    }
  }

  private log(level: LogLevel, message: string, meta?: LogMeta): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const color = LEVEL_COLORS[level];
    const label = level.toUpperCase().padEnd(5);
    const metaString = this.formatMeta(meta);

    const line = `${color}[${timestamp}] [${label}]${RESET_COLOR} ${message}${metaString}`;

    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  public error(message: string, meta?: LogMeta): void {
    this.log("error", message, meta);
  }

  public warn(message: string, meta?: LogMeta): void {
    this.log("warn", message, meta);
  }

  public info(message: string, meta?: LogMeta): void {
    this.log("info", message, meta);
  }

  public debug(message: string, meta?: LogMeta): void {
    this.log("debug", message, meta);
  }

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }
}

export const logger = new Logger((process.env.LOG_LEVEL as LogLevel) ?? "info");
