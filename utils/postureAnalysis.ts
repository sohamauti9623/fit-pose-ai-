export type Keypoint = {
  x: number;
  y: number;
};

export type PoseLikeLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type BodyKeypoints = {
  leftShoulder: Keypoint;
  rightShoulder: Keypoint;
  neck: Keypoint;
};

export type PostureMetric = {
  id: string;
  label: string;
  value: number;
  unit: 'deg' | 'pct';
  goodThreshold: number;
  warningThreshold: number;
  weight: number;
};

export type PostureResult = {
  score: number;
  issues: string[];
  details: {
    neckAngle: number;
    shoulderDiff: number;
    torsoTilt: number;
    hipTilt: number;
    headOffsetPercent: number;
    symmetryOffsetPercent: number;
  };
  metrics: PostureMetric[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const isLandmarkArray = (input: BodyKeypoints | PoseLikeLandmark[]): input is PoseLikeLandmark[] =>
  Array.isArray(input);

const midpoint = (a: Keypoint, b: Keypoint): Keypoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2
});

const safePoint = (point?: PoseLikeLandmark | Keypoint | null): Keypoint | null =>
  point ? { x: point.x, y: point.y } : null;

const pick = (landmarks: PoseLikeLandmark[], primary: number, fallback?: number): Keypoint | null => {
  const candidate = landmarks[primary] ?? (typeof fallback === 'number' ? landmarks[fallback] : undefined);
  if (!candidate) {
    return null;
  }

  if (typeof candidate.visibility === 'number' && candidate.visibility < 0.3) {
    return null;
  }

  return { x: candidate.x, y: candidate.y };
};

const buildMetrics = (input: {
  neckAngle: number;
  shoulderTilt: number;
  torsoTilt: number;
  hipTilt: number;
  headOffsetPercent: number;
  symmetryOffsetPercent: number;
}): PostureMetric[] => [
  {
    id: 'neck-tilt',
    label: 'Neck tilt',
    value: Number(input.neckAngle.toFixed(1)),
    unit: 'deg',
    goodThreshold: 6,
    warningThreshold: 12,
    weight: 0.24
  },
  {
    id: 'shoulder-tilt',
    label: 'Shoulder tilt',
    value: Number(input.shoulderTilt.toFixed(1)),
    unit: 'deg',
    goodThreshold: 4,
    warningThreshold: 9,
    weight: 0.2
  },
  {
    id: 'torso-tilt',
    label: 'Torso tilt',
    value: Number(input.torsoTilt.toFixed(1)),
    unit: 'deg',
    goodThreshold: 3,
    warningThreshold: 7,
    weight: 0.2
  },
  {
    id: 'hip-tilt',
    label: 'Hip tilt',
    value: Number(input.hipTilt.toFixed(1)),
    unit: 'deg',
    goodThreshold: 4,
    warningThreshold: 8,
    weight: 0.14
  },
  {
    id: 'head-offset',
    label: 'Head offset',
    value: Number(input.headOffsetPercent.toFixed(1)),
    unit: 'pct',
    goodThreshold: 8,
    warningThreshold: 15,
    weight: 0.12
  },
  {
    id: 'symmetry-offset',
    label: 'Body symmetry',
    value: Number(input.symmetryOffsetPercent.toFixed(1)),
    unit: 'pct',
    goodThreshold: 7,
    warningThreshold: 13,
    weight: 0.1
  }
];

const summarizeMetricIssue = (metric: PostureMetric): string | null => {
  if (metric.value <= metric.goodThreshold) {
    return null;
  }

  if (metric.id === 'neck-tilt') {
    return 'Neck is leaning off-center. Keep ears stacked over shoulders.';
  }

  if (metric.id === 'shoulder-tilt') {
    return 'Shoulders are uneven. Relax traps and level both shoulders.';
  }

  if (metric.id === 'torso-tilt') {
    return 'Torso is tilted. Distribute weight evenly on both feet.';
  }

  if (metric.id === 'hip-tilt') {
    return 'Hips are not level. Square your pelvis and avoid side-loading one leg.';
  }

  if (metric.id === 'head-offset') {
    return 'Head is shifted from center. Draw chin back and align with sternum.';
  }

  return 'Left-right body symmetry can improve. Stand tall with balanced posture.';
};

const buildScore = (metrics: PostureMetric[]): number => {
  const weightedPenalty = metrics.reduce((sum, metric) => {
    if (metric.value <= metric.goodThreshold) {
      return sum;
    }

    const range = Math.max(metric.warningThreshold - metric.goodThreshold, 0.0001);
    const severity = clamp((metric.value - metric.goodThreshold) / range, 0, 2);
    return sum + severity * metric.weight;
  }, 0);

  const analysisCoverage = metrics.length < 6 ? 0.08 : 0;
  const score = 100 - (weightedPenalty + analysisCoverage) * 100;

  return clamp(Math.round(score), 0, 100);
};

/**
 * Multi-point posture analysis using MediaPipe landmarks when available.
 * Falls back to shoulder + neck-only heuristics when limited points exist.
 */
export function analyzePosture(input: BodyKeypoints | PoseLikeLandmark[]): PostureResult {
  if (!isLandmarkArray(input)) {
    const leftShoulder = input.leftShoulder;
    const rightShoulder = input.rightShoulder;
    const neck = input.neck;
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const shoulderWidth = Math.max(Math.abs(rightShoulder.x - leftShoulder.x), 0.0001);

    const neckAngle = Math.abs(toDegrees(Math.atan2(neck.x - shoulderMid.x, shoulderMid.y - neck.y || 1)));
    const shoulderTilt = Math.abs(toDegrees(Math.atan2(rightShoulder.y - leftShoulder.y, shoulderWidth)));

    const metrics = buildMetrics({
      neckAngle,
      shoulderTilt,
      torsoTilt: neckAngle * 0.75,
      hipTilt: shoulderTilt * 0.8,
      headOffsetPercent: Math.abs(((neck.x - shoulderMid.x) / shoulderWidth) * 100),
      symmetryOffsetPercent: Math.abs(((neck.x - shoulderMid.x) / shoulderWidth) * 75)
    });

    const score = buildScore(metrics.slice(0, 4));
    const issues = metrics.map(summarizeMetricIssue).filter((issue): issue is string => Boolean(issue));

    return {
      score,
      issues: issues.length > 0 ? issues : ['Good posture baseline. Add full-body framing for deeper analysis.'],
      details: {
        neckAngle: Number(neckAngle.toFixed(1)),
        shoulderDiff: Number(shoulderTilt.toFixed(1)),
        torsoTilt: Number((neckAngle * 0.75).toFixed(1)),
        hipTilt: Number((shoulderTilt * 0.8).toFixed(1)),
        headOffsetPercent: Number(Math.abs(((neck.x - shoulderMid.x) / shoulderWidth) * 100).toFixed(1)),
        symmetryOffsetPercent: Number((Math.abs((neck.x - shoulderMid.x) / shoulderWidth) * 75).toFixed(1))
      },
      metrics
    };
  }

  const landmarks = input;
  const nose = pick(landmarks, 0);
  const leftShoulder = pick(landmarks, 11, 3);
  const rightShoulder = pick(landmarks, 12, 4);
  const leftHip = pick(landmarks, 23);
  const rightHip = pick(landmarks, 24);

  if (!nose || !leftShoulder || !rightShoulder) {
    return analyzePosture({
      leftShoulder: safePoint(leftShoulder) ?? { x: 0.42, y: 0.46 },
      rightShoulder: safePoint(rightShoulder) ?? { x: 0.58, y: 0.46 },
      neck: safePoint(nose) ?? { x: 0.5, y: 0.36 }
    });
  }

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const shoulderWidth = Math.max(Math.abs(rightShoulder.x - leftShoulder.x), 0.0001);
  const hipMid = leftHip && rightHip ? midpoint(leftHip, rightHip) : null;

  const shoulderTilt = Math.abs(toDegrees(Math.atan2(rightShoulder.y - leftShoulder.y, shoulderWidth)));
  const neckAngle = Math.abs(toDegrees(Math.atan2(nose.x - shoulderMid.x, shoulderMid.y - nose.y || 1)));

  const torsoTilt = hipMid
    ? Math.abs(toDegrees(Math.atan2(shoulderMid.x - hipMid.x, hipMid.y - shoulderMid.y || 1)))
    : neckAngle * 0.65;

  const hipTilt =
    leftHip && rightHip
      ? Math.abs(toDegrees(Math.atan2(rightHip.y - leftHip.y, Math.max(Math.abs(rightHip.x - leftHip.x), 0.0001))))
      : shoulderTilt * 0.8;

  const headOffsetPercent = Math.abs(((nose.x - shoulderMid.x) / shoulderWidth) * 100);
  const symmetryOffsetPercent = hipMid ? Math.abs(((shoulderMid.x - hipMid.x) / shoulderWidth) * 100) : headOffsetPercent;

  const metrics = buildMetrics({
    neckAngle,
    shoulderTilt,
    torsoTilt,
    hipTilt,
    headOffsetPercent,
    symmetryOffsetPercent
  });

  const score = buildScore(metrics);
  const issues = metrics.map(summarizeMetricIssue).filter((issue): issue is string => Boolean(issue));

  return {
    score,
    issues: issues.length > 0 ? issues : ['Great posture! Alignment is balanced across head, shoulders, torso, and hips.'],
    details: {
      neckAngle: Number(neckAngle.toFixed(1)),
      shoulderDiff: Number(shoulderTilt.toFixed(1)),
      torsoTilt: Number(torsoTilt.toFixed(1)),
      hipTilt: Number(hipTilt.toFixed(1)),
      headOffsetPercent: Number(headOffsetPercent.toFixed(1)),
      symmetryOffsetPercent: Number(symmetryOffsetPercent.toFixed(1))
    },
    metrics
  };
}
