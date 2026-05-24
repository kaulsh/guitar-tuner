import { logger } from "./logger.js";

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;

export async function startAudio(): Promise<AnalyserNode> {
  logger.info("Requesting microphone access");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });

  const ctx = new AudioContext();

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const source = ctx.createMediaStreamSource(stream);

  const analyser = ctx.createAnalyser();

  analyser.fftSize = 2048;

  source.connect(analyser);

  mediaStream = stream;
  audioContext = ctx;

  logger.info("Audio pipeline ready");

  return analyser;
}

export function stopAudio(): void {
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  }

  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }

  logger.info("Audio pipeline stopped");
}
