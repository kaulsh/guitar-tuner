import { logger } from "./logger";

(async function main() {
  try {
    logger.info("init");
  } catch (err) {
    logger.error(err);
  }
})();
