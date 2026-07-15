export function formatCurrency(value: number, symbol = "£"): string {
  return `${symbol}${value.toFixed(1)}m`;
}

export function formatPoints(points: number): string {
  return `${points >= 0 ? "+" : ""}${points} pts`;
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatMatchTime(minute: number, extraTime?: number): string {
  if (extraTime && extraTime > 0) return `${minute}+${extraTime}'`;
  return `${minute}'`;
}

export function formatMatchStatus(status: string): string {
  const statusMap: Record<string, string> = {
    NS: "Not Started",
    "1H": "1st Half",
    HT: "Half Time",
    "2H": "2nd Half",
    ET: "Extra Time",
    P: "Penalties",
    FT: "Full Time",
    AET: "After Extra Time",
    PEN: "After Penalties",
    PST: "Postponed",
    CANC: "Cancelled",
    ABD: "Abandoned",
    SUSP: "Suspended",
    LIVE: "Live",
  };
  return statusMap[status] ?? status;
}

export function formatDate(date: Date | string, includeTime = true): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };

  const datePart = d.toLocaleDateString("en-GB", dateOptions);
  if (!includeTime) return datePart;

  const timePart = d.toLocaleTimeString("en-GB", timeOptions);
  return `${datePart}, ${timePart}`;
}

export function formatOrdinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = n % 100;
  return `${n}${suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]}`;
}

export function formatPlayerName(name: string, maxLength = 20): string {
  return name.length > maxLength ? `${name.slice(0, maxLength - 1)}.` : name;
}

export function formatTransferFee(fee: number | null): string {
  if (fee === null || fee === undefined) return "Free";
  return formatCurrency(fee);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}
