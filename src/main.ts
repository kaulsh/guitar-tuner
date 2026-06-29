import { startAudio, stopAudio } from "./audio.js";
import { detectFrequency } from "./frequency.js";
import { logger } from "./logger.js";
import { NoteResult, PitchStabiliser } from "./pitch-stabiliser.js";
import {
  clearStartError,
  hideStartScreen,
  hideTunerUi,
  onStartButtonClick,
  onStopButtonClick,
  resetFrequencyDisplay,
  resetNoteDisplay,
  showStartError,
  showStartScreen,
  showTunerUi,
  updateFrequency,
  updateNote,
} from "./ui.js";

(async function main() {
  logger.info("Guitar tuner initializing");
  logger.debug("Page loaded", {
    secureContext: window.isSecureContext,
    protocol: location.protocol,
    href: location.href,
  });

  try {
    let analyser: AnalyserNode | null = null;
    let running = false;
    const stabiliser = new PitchStabiliser();

    function updateDisplay(stable: NoteResult | null): void {
      if (stable === null) {
        resetNoteDisplay();
      } else {
        updateNote(stable.note, stable.octave);
      }
    }

    function tick(): void {
      if (!running || !analyser) {
        return;
      }

      const raw = detectFrequency(analyser);

      updateFrequency(raw);

      const stable = stabiliser.update(raw);

      updateDisplay(stable);

      requestAnimationFrame(tick);
    }

    onStartButtonClick(async () => {
      logger.info("Start button clicked");
      clearStartError();

      try {
        analyser = await startAudio();

        hideStartScreen();
        showTunerUi();
        updateFrequency(null);
        stabiliser.reset();
        resetNoteDisplay();

        running = true;

        logger.info("Tuner started");

        requestAnimationFrame(tick);
      } catch (err) {
        logger.error(err, "Failed to start tuner");
        showStartError(logger.formatError(err));
        running = false;
      }
    });

    onStopButtonClick(() => {
      logger.info("Stop button clicked");

      running = false;
      analyser = null;
      stabiliser.reset();

      stopAudio();
      hideTunerUi();
      showStartScreen();
      resetFrequencyDisplay();

      logger.info("Tuner stopped");
    });
  } catch (err) {
    logger.error(err, "Initialization failed");
    showStartError(logger.formatError(err));
  }
})();
