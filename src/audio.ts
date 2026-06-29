import { logger } from "./logger.js";

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;

export async function startAudio(): Promise<AnalyserNode> {
  logger.info("Starting audio pipeline");
  logger.debug("Environment", {
    secureContext: window.isSecureContext,
    protocol: location.protocol,
    userAgent: navigator.userAgent,
    mediaDevices: Boolean(navigator.mediaDevices),
    getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
  });

  if (!window.isSecureContext) {
    throw new Error(
      "Microphone access requires a secure context (HTTPS or localhost)",
    );
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported in this browser");
  }

  logger.info("Requesting microphone access");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
  } catch (err) {
    logger.error(err, "getUserMedia failed");
    throw err;
  }

  logger.info("Microphone access granted", {
    tracks: stream.getAudioTracks().map((track) => ({
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    })),
  });

  const ctx = new AudioContext();
  logger.debug("AudioContext created", {
    state: ctx.state,
    sampleRate: ctx.sampleRate,
  });

  if (ctx.state === "suspended") {
    logger.info("Resuming suspended AudioContext");
    await ctx.resume();
    logger.debug("AudioContext state after resume", { state: ctx.state });
  }

  const source = ctx.createMediaStreamSource(stream);

  const analyser = ctx.createAnalyser();

  analyser.fftSize = 4096;

  source.connect(analyser);

  mediaStream = stream;
  audioContext = ctx;

  logger.info("Audio pipeline ready", {
    fftSize: analyser.fftSize,
    frequencyBinCount: analyser.frequencyBinCount,
  });

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
