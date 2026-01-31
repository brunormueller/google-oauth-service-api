function getTimestamp() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function format(level, args) {
  const prefix = `[${getTimestamp()}]`;
  return [prefix, level ? `[${level}]` : null, ...args].filter(Boolean);
}

export function logInfo(...args) {
  console.log(...format("INFO", args));
}

export function logWarn(...args) {
  console.warn(...format("WARN", args));
}

export function logError(...args) {
  console.error(...format("ERROR", args));
}

