import { startAudio, stopAudio } from "./audio.js";
import { detectFrequency } from "./frequency.js";
import { logger } from "./logger.js";
import { NoteResult, PitchStabiliser } from "./pitch-stabiliser.js";
import {
  hideStartScreen,
  hideTunerUi,
  onStartButtonClick,
  onStopButtonClick,
  resetFrequencyDisplay,
  resetNoteDisplay,
  showStartScreen,
  showTunerUi,
  updateFrequency,
  updateNote,
} from "./ui.js";

(async function main() {
  logger.info("Guitar tuner initializing");

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
        logger.error(err);
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
    logger.error(err);
  }
})();
