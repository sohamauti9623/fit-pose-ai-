import { Platform } from 'react-native';

export type PoseLandmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

type PoseConstructor = new (config: { locateFile: (file: string) => string }) => {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (listener: (results: { poseLandmarks?: PoseLandmark[] }) => void) => void;
  send: (input: { image: unknown }) => Promise<void>;
};

const MEDIAPIPE_POSE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose';
const MEDIAPIPE_POSE_SCRIPT = `${MEDIAPIPE_POSE_CDN}/pose.js`;

let poseInstance: InstanceType<PoseConstructor> | null = null;
let poseLoaderPromise: Promise<InstanceType<PoseConstructor> | null> | null = null;

const hasDom = () =>
  typeof (globalThis as { window?: unknown }).window !== 'undefined' &&
  typeof (globalThis as { document?: unknown }).document !== 'undefined';

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (!hasDom()) {
      resolve();
      return;
    }

    const documentRef = (globalThis as { document: any }).document;
    const existing = documentRef.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = documentRef.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    documentRef.body.appendChild(script);
  });

const createImageElement = (imageUri: string) =>
  new Promise<unknown>((resolve, reject) => {
    const image = new (globalThis as { Image: new () => any }).Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load for pose detection.'));
    image.src = imageUri;
  });

export async function loadPoseModel(): Promise<InstanceType<PoseConstructor> | null> {
  if (poseInstance) {
    return poseInstance;
  }

  if (poseLoaderPromise) {
    return poseLoaderPromise;
  }

  poseLoaderPromise = (async () => {
    if (!hasDom()) {
      return null;
    }

    await loadScript(MEDIAPIPE_POSE_SCRIPT);

    const Pose = (globalThis as { Pose?: PoseConstructor }).Pose;
    if (!Pose) {
      return null;
    }

    const pose = new Pose({
      locateFile: (file: string) => `${MEDIAPIPE_POSE_CDN}/${file}`
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    poseInstance = pose;
    return pose;
  })();

  return poseLoaderPromise;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function generateMockPoseLandmarks(seed = Date.now()): PoseLandmark[] {
  const jitter = (offset: number) => {
    const value = Math.sin(seed * 0.001 + offset) * 0.012;
    return Number(value.toFixed(5));
  };

  const leftShoulderX = 0.42 + jitter(1);
  const rightShoulderX = 0.58 + jitter(2);
  const shoulderY = 0.46 + jitter(3);
  const noseX = 0.5 + jitter(4);
  const noseY = 0.3 + jitter(5);

  const landmarks = Array.from({ length: 33 }, (_, index) => ({
    x: clamp01(0.5 + jitter(index + 1)),
    y: clamp01(0.5 + jitter(index + 2)),
    z: -0.08 + jitter(index + 3),
    visibility: 0.9
  }));

  landmarks[0] = { x: clamp01(noseX), y: clamp01(noseY), z: -0.12, visibility: 0.98 }; // nose
  landmarks[11] = {
    x: clamp01(leftShoulderX),
    y: clamp01(shoulderY),
    z: -0.22,
    visibility: 0.99
  }; // left shoulder
  landmarks[12] = {
    x: clamp01(rightShoulderX),
    y: clamp01(shoulderY + jitter(10)),
    z: -0.21,
    visibility: 0.99
  }; // right shoulder

  return landmarks;
}

export async function detectPoseLandmarks(imageUri: string): Promise<PoseLandmark[]> {
  if (!imageUri) {
    return generateMockPoseLandmarks();
  }

  const pose = await loadPoseModel();

  if (!pose || Platform.OS !== 'web' || !hasDom()) {
    return generateMockPoseLandmarks();
  }

  try {
    const image = await createImageElement(imageUri);
    const landmarks = await new Promise<PoseLandmark[]>((resolve) => {
      let resolved = false;
      pose.onResults((results) => {
        if (!resolved) {
          resolved = true;
          resolve(results.poseLandmarks ?? []);
        }
      });

      pose
        .send({ image })
        .catch(() => {
          if (!resolved) {
            resolved = true;
            resolve([]);
          }
        });
    });

    if (landmarks.length > 0) {
      return landmarks;
    }
  } catch (error) {
    console.warn('MediaPipe pose detection failed, falling back to mock data.', error);
  }

  return generateMockPoseLandmarks();
}
