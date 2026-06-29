function timestamp(): string {
  return new Date().toISOString();
}

function prefix(level: string): string {
  return `[${timestamp()}] [${level}]`;
}

export function formatError(error: unknown): string {
  if (error instanceof DOMException) {
    return `${error.name}: ${error.message}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function info(message: string, ...details: unknown[]) {
  console.log(prefix("INFO"), message, ...details);
}

function debug(message: string, ...details: unknown[]) {
  console.log(prefix("DEBUG"), message, ...details);
}

function error(error: unknown, context?: string) {
  const message = formatError(error);
  if (context) {
    console.error(prefix("ERROR"), context, message, error);
  } else {
    console.error(prefix("ERROR"), message, error);
  }
}

export const logger = {
  info,
  debug,
  error,
  formatError,
};
