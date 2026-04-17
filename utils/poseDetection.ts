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

export async function detectPoseLandmarks(imageUri: string): Promise<PoseLandmark[]> {
  if (!imageUri) {
    return [];
  }

  const pose = await loadPoseModel();

  if (!pose || Platform.OS !== 'web' || !hasDom()) {
    return [];
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
    console.warn('MediaPipe pose detection failed.', error);
  }

  return [];
}
