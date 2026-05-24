function info(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function error(error: unknown) {
  if (error instanceof Error) {
    console.error(`[${new Date().toISOString()}] ${error.name}: ${error.message}`);
  } else {
    console.error(`[${new Date().toISOString()}] ${error}`);
  }
}

export const logger = {
  info,
  error,
};
