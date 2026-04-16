import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import Svg, { Circle, Line } from 'react-native-svg';
import { RootStackParamList } from '../navigation';
import { analyzePosture, Keypoint } from '../utils/postureAnalysis';
import { detectPoseLandmarks } from '../utils/poseDetection';

type Props = StackScreenProps<RootStackParamList, 'Result'>;

const POINT_LABELS = ['Left shoulder', 'Right shoulder', 'Neck'] as const;
const GOOD_COLOR = '#22c55e';
const BAD_COLOR = '#ef4444';
const NEUTRAL_COLOR = '#94a3b8';

type Connection = {
  from: Keypoint;
  to: Keypoint;
  color: string;
  width: number;
};

export default function ResultScreen({ route }: Props) {
  const { imageUri } = route.params;
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [points, setPoints] = useState<Keypoint[]>([]);
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  const result = useMemo(() => {
    if (points.length < 3) {
      return null;
    }

    return analyzePosture({
      leftShoulder: points[0],
      rightShoulder: points[1],
      neck: points[2]
    });
  }, [points]);

  const onImageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setImageSize({ width, height });
  };

  const onImageTap = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (points.length >= 3) {
      return;
    }

    const { locationX, locationY } = event.nativeEvent;
    setPoints((prev) => [...prev, { x: locationX, y: locationY }]);
  };

  const resetPoints = () => {
    setPoints([]);
    setDetectionStatus('idle');
  };

  useEffect(() => {
    if (!imageSize.width || !imageSize.height || points.length >= 3 || detectionStatus !== 'idle') {
      return;
    }

    let active = true;

    const runDetection = async () => {
      setDetectionStatus('loading');

      const landmarks = await detectPoseLandmarks(imageUri);
      if (!active) {
        return;
      }

      const leftShoulder = landmarks[11] ?? landmarks[3];
      const rightShoulder = landmarks[12] ?? landmarks[4];
      const nose = landmarks[0];

      if (leftShoulder && rightShoulder && nose) {
        setPoints([
          { x: leftShoulder.x * imageSize.width, y: leftShoulder.y * imageSize.height },
          { x: rightShoulder.x * imageSize.width, y: rightShoulder.y * imageSize.height },
          {
            x: ((leftShoulder.x + rightShoulder.x) / 2) * imageSize.width,
            y: ((nose.y + leftShoulder.y + rightShoulder.y) / 3) * imageSize.height
          }
        ]);
      }

      setDetectionStatus('done');
    };

    runDetection();

    return () => {
      active = false;
    };
  }, [detectionStatus, imageSize.height, imageSize.width, imageUri, points.length]);

  const scoreColor = !result ? '#94a3b8' : result.score >= 80 ? '#22c55e' : '#ef4444';
  const leftShoulder = points[0];
  const rightShoulder = points[1];
  const neck = points[2];
  const shoulderMidpoint =
    leftShoulder && rightShoulder
      ? {
          x: (leftShoulder.x + rightShoulder.x) / 2,
          y: (leftShoulder.y + rightShoulder.y) / 2
        }
      : null;

  const overlayData = useMemo(() => {
    if (!leftShoulder || !rightShoulder || !neck || !shoulderMidpoint) {
      return { connections: [] as Connection[], neckGood: true, shouldersGood: true };
    }

    const neckGood = (result?.details.neckAngle ?? 0) <= 10;
    const shouldersGood = (result?.details.shoulderDiff ?? 0) <= 7;

    const connections: Connection[] = [
      {
        from: leftShoulder,
        to: rightShoulder,
        color: shouldersGood ? GOOD_COLOR : BAD_COLOR,
        width: 4
      },
      {
        from: neck,
        to: shoulderMidpoint,
        color: neckGood ? GOOD_COLOR : BAD_COLOR,
        width: 4
      },
      {
        from: neck,
        to: leftShoulder,
        color: neckGood && shouldersGood ? GOOD_COLOR : NEUTRAL_COLOR,
        width: 2
      },
      {
        from: neck,
        to: rightShoulder,
        color: neckGood && shouldersGood ? GOOD_COLOR : NEUTRAL_COLOR,
        width: 2
      }
    ];

    return { connections, neckGood, shouldersGood };
  }, [leftShoulder, neck, result?.details.neckAngle, result?.details.shoulderDiff, rightShoulder, shoulderMidpoint]);

  const postureLossInches = useMemo(() => {
    if (!result) {
      return 1.8;
    }

    const estimatedLoss = 0.6 + result.details.neckAngle * 0.07 + result.details.shoulderDiff * 0.05;
    return Number(Math.max(0.5, Math.min(3.5, estimatedLoss)).toFixed(1));
  }, [result]);

  const handleShareScore = async () => {
    if (!result) {
      return;
    }

    try {
      await Share.share({
        message: `My FitPose score is ${result.score}/100. I look ${postureLossInches} inches shorter from posture.`
      });
    } catch (error) {
      console.warn('Share failed:', error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headline}>Posture Insight</Text>
      <Text style={styles.subheadline}>AI-powered body alignment analysis</Text>

      <Pressable style={styles.imageWrap} onLayout={onImageLayout} onPress={onImageTap}>
        <Image source={{ uri: imageUri }} style={styles.preview} />

        <Svg style={styles.svgOverlay} pointerEvents="none">
          {overlayData.connections.map((connection, index) => (
            <Line
              key={`line-${index}-${connection.from.x}-${connection.to.x}`}
              x1={connection.from.x}
              y1={connection.from.y}
              x2={connection.to.x}
              y2={connection.to.y}
              stroke={connection.color}
              strokeWidth={connection.width}
              strokeLinecap="round"
            />
          ))}
        </Svg>

        {points.map((point, index) => (
          <Svg key={`${POINT_LABELS[index]}-${point.x}-${point.y}`} style={styles.svgOverlay} pointerEvents="none">
            <Circle
              cx={point.x}
              cy={point.y}
              r={8}
              fill={
                index === 2
                  ? overlayData.neckGood
                    ? GOOD_COLOR
                    : BAD_COLOR
                  : overlayData.shouldersGood
                    ? GOOD_COLOR
                    : BAD_COLOR
              }
              stroke="#052e16"
              strokeWidth={2}
            />
          </Svg>
        ))}

        {points.map((point, index) => (
          <Text
            key={`${POINT_LABELS[index]}-label-${point.x}-${point.y}`}
            style={[styles.markerLabel, { left: point.x + 10, top: point.y - 10 }]}
          >
            {POINT_LABELS[index]}
          </Text>
        ))}
      </Pressable>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>POSTURE SCORE</Text>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{result ? `${result.score} / 100` : '-- / 100'}</Text>
        <Text style={styles.lossText}>You look {postureLossInches} inches shorter due to posture</Text>
        <Text style={styles.confidenceText}>Your posture reduces perceived confidence</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>Neck</Text>
            <Text style={styles.metricValue}>{result ? `${result.details.neckAngle}°` : '--'}</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>Shoulders</Text>
            <Text style={styles.metricValue}>{result ? `${result.details.shoulderDiff}°` : '--'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.feedbackCard}>
        <Text style={styles.feedbackTitle}>Alignment Feedback</Text>
        {detectionStatus === 'loading' && <Text style={styles.autoText}>Detecting pose with MediaPipe…</Text>}
        {!result && detectionStatus !== 'loading' && (
          <Text style={styles.autoText}>Tap left shoulder, right shoulder, and neck to calibrate overlay.</Text>
        )}
        {result?.issues.map((issue) => {
          const good = issue.toLowerCase().includes('great posture');
          return (
            <View key={issue} style={styles.issueRow}>
              <View style={[styles.dot, { backgroundColor: good ? GOOD_COLOR : BAD_COLOR }]} />
              <Text style={styles.issueText}>{issue}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Improve My Posture</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleShareScore}>
          <Text style={styles.secondaryButtonText}>Share Your Score</Text>
        </Pressable>
      </View>

      <View style={styles.controlsRow}>
        <Text style={styles.metaText}>
          Image area: {Math.round(imageSize.width)} × {Math.round(imageSize.height)}
        </Text>
        <Pressable style={styles.resetButton} onPress={resetPoints}>
          <Text style={styles.resetText}>Reset points</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0b1220',
    alignItems: 'center',
    padding: 20,
    gap: 12
  },
  headline: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 0.3
  },
  subheadline: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: -4,
    marginBottom: 4
  },
  imageWrap: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 3 / 4,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
    position: 'relative'
  },
  preview: {
    width: '100%',
    height: '100%'
  },
  svgOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  markerLabel: {
    position: 'absolute',
    color: '#f8fafc',
    fontSize: 11,
    backgroundColor: 'rgba(2,6,23,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  controlsRow: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12
  },
  resetButton: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  resetText: {
    color: '#e2e8f0',
    fontWeight: '600'
  },
  scoreCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 }
  },
  scoreLabel: {
    color: '#64748b',
    fontSize: 12,
    letterSpacing: 1.6,
    fontWeight: '700'
  },
  scoreValue: {
    fontSize: 62,
    fontWeight: '900',
    lineHeight: 68,
    textAlign: 'center'
  },
  lossText: {
    color: '#f1f5f9',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600'
  },
  confidenceText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center'
  },
  metricsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  metricPill: {
    flex: 1,
    backgroundColor: '#0b1220',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center'
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 12
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700'
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  feedbackTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8
  },
  autoText: {
    color: '#94a3b8',
    fontSize: 13
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6
  },
  issueText: {
    color: '#e2e8f0',
    flex: 1,
    lineHeight: 20
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    gap: 10
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#052e16',
    fontWeight: '800',
    fontSize: 16
  },
  secondaryButton: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1
  },
  secondaryButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15
  }
});
