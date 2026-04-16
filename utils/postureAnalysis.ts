export type Keypoint = {
  x: number;
  y: number;
};

export type BodyKeypoints = {
  leftShoulder: Keypoint;
  rightShoulder: Keypoint;
  neck: Keypoint;
};

export type PostureResult = {
  score: number;
  issues: string[];
  neckAngle: number;
  shoulderDifference: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * Analyzes posture from real body keypoints (neck + shoulders).
 *
 * neckAngle:
 *  - deviation of the neck from the vertical line through the shoulder midpoint
 * shoulderDifference:
 *  - tilt of the shoulder line relative to horizontal
 */
export function analyzePosture(keypoints: BodyKeypoints): PostureResult {
  const shoulderMidX = (keypoints.leftShoulder.x + keypoints.rightShoulder.x) / 2;
  const shoulderMidY = (keypoints.leftShoulder.y + keypoints.rightShoulder.y) / 2;

  const shoulderVectorX = keypoints.rightShoulder.x - keypoints.leftShoulder.x;
  const shoulderVectorY = keypoints.rightShoulder.y - keypoints.leftShoulder.y;

  const shoulderDifference = Math.abs(toDegrees(Math.atan2(shoulderVectorY, shoulderVectorX || 1)));

  const neckVectorX = keypoints.neck.x - shoulderMidX;
  const neckVectorY = shoulderMidY - keypoints.neck.y;
  const neckAngle = Math.abs(toDegrees(Math.atan2(neckVectorX, neckVectorY || 1)));

  let score = 100;
  const issues: string[] = [];

  if (neckAngle > 10) {
    score -= Math.min(40, Math.round(neckAngle * 1.8));
    issues.push('Neck tilt is high. Try keeping your head centered over your shoulders.');
  }

  if (shoulderDifference > 7) {
    score -= Math.min(35, Math.round(shoulderDifference * 2));
    issues.push('Shoulders are not level. Relax and align both shoulders evenly.');
  }

  if (issues.length === 0) {
    issues.push('Great posture! Neck and shoulders are well aligned.');
  }

  return {
    score: clamp(score, 0, 100),
    issues,
    neckAngle: Number(neckAngle.toFixed(1)),
    shoulderDifference: Number(shoulderDifference.toFixed(1))
  };
}
