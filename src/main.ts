import { startAudio, stopAudio } from "./audio.js";
import { detectFrequency } from "./frequency.js";
import { logger } from "./logger.js";
import {
  hideStartScreen,
  hideTunerUi,
  onStartButtonClick,
  onStopButtonClick,
  resetFrequencyDisplay,
  showStartScreen,
  showTunerUi,
  updateFrequency,
} from "./ui.js";

(async function main() {
  logger.info("Guitar tuner initializing");

  try {
    let analyser: AnalyserNode | null = null;
    let running = false;

    function tick(): void {
      if (!running || !analyser) {
        return;
      }

      const frequency = detectFrequency(analyser);

      updateFrequency(frequency);

      requestAnimationFrame(tick);
    }

    onStartButtonClick(async () => {
      logger.info("Start button clicked");

      try {
        analyser = await startAudio();

        hideStartScreen();
        showTunerUi();
        updateFrequency(null);

        running = true;

        logger.info("Tuner started");

        requestAnimationFrame(tick);
      } catch (err) {
        logger.error(err);
        running = false;
      }
    });

    onStopButtonClick(() => {
      logger.info("Stop button clicked");

      running = false;
      analyser = null;

      stopAudio();
      hideTunerUi();
      showStartScreen();
      resetFrequencyDisplay();

      logger.info("Tuner stopped");
    });
  } catch (err) {
    logger.error(err);
  }
})();
