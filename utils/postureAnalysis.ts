export type Keypoint = {
  x: number;
  y: number;
};

export type MockKeypoints = {
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

export function analyzePosture(keypoints: MockKeypoints): PostureResult {
  const shoulderMid = {
    x: (keypoints.leftShoulder.x + keypoints.rightShoulder.x) / 2,
    y: (keypoints.leftShoulder.y + keypoints.rightShoulder.y) / 2
  };

  const shoulderDx = keypoints.rightShoulder.x - keypoints.leftShoulder.x;
  const shoulderDy = keypoints.rightShoulder.y - keypoints.leftShoulder.y;

  const shoulderTiltRadians = Math.atan2(shoulderDy, shoulderDx || 1);
  const shoulderDifference = Math.abs((shoulderTiltRadians * 180) / Math.PI);

  const neckDx = keypoints.neck.x - shoulderMid.x;
  const neckDy = shoulderMid.y - keypoints.neck.y;
  const neckAngle = Math.abs((Math.atan2(neckDx, neckDy || 1) * 180) / Math.PI);

  let score = 100;
  const issues: string[] = [];

  if (neckAngle > 8) {
    score -= Math.min(35, Math.round(neckAngle * 2));
    issues.push('Head tilt detected: keep your neck more centered.');
  }

  if (shoulderDifference > 6) {
    score -= Math.min(30, Math.round(shoulderDifference * 2));
    issues.push('Uneven shoulders detected: relax and level your shoulders.');
  }

  if (issues.length === 0) {
    issues.push('Great posture! Neck and shoulders look aligned.');
  }

  return {
    score: clamp(score, 0, 100),
    issues,
    neckAngle: Number(neckAngle.toFixed(1)),
    shoulderDifference: Number(shoulderDifference.toFixed(1))
  };
}

export function generateMockKeypoints(): MockKeypoints {
  const randomOffset = () => (Math.random() - 0.5) * 20;

  return {
    leftShoulder: { x: 120 + randomOffset(), y: 260 + randomOffset() },
    rightShoulder: { x: 240 + randomOffset(), y: 260 + randomOffset() },
    neck: { x: 180 + randomOffset(), y: 200 + randomOffset() }
  };
}
