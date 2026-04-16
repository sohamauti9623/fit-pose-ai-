import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { analyzePosture, Keypoint } from '../utils/postureAnalysis';
import { detectPoseLandmarks } from '../utils/poseDetection';

type Props = StackScreenProps<RootStackParamList, 'Result'>;

const POINT_LABELS = ['Left shoulder', 'Right shoulder', 'Neck'] as const;

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.instructionTitle}>Tap body keypoints on the photo</Text>
      <Text style={styles.instructionText}>
        {points.length < 3
          ? `Next point: ${POINT_LABELS[points.length]}`
          : 'All keypoints selected. You can reset and re-tap if needed.'}
      </Text>
      <Text style={styles.autoText}>
        {detectionStatus === 'loading'
          ? 'Detecting pose with MediaPipe...'
          : 'Auto-detection is enabled. Tap manually to fine-tune points if needed.'}
      </Text>

      <Pressable style={styles.imageWrap} onLayout={onImageLayout} onPress={onImageTap}>
        <Image source={{ uri: imageUri }} style={styles.preview} />

        {points.map((point, index) => (
          <View
            key={`${POINT_LABELS[index]}-${point.x}-${point.y}`}
            style={[styles.marker, { left: point.x - 8, top: point.y - 8 }]}
          />
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

      <View style={styles.controlsRow}>
        <Text style={styles.metaText}>
          Image area: {Math.round(imageSize.width)} × {Math.round(imageSize.height)}
        </Text>
        <Pressable style={styles.resetButton} onPress={resetPoints}>
          <Text style={styles.resetText}>Reset points</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.scoreLabel}>Posture Score</Text>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{result ? result.score : '--'}</Text>

        <Text style={styles.metrics}>
          Neck angle: {result ? `${result.details.neckAngle}°` : 'Select keypoints first'}
        </Text>
        <Text style={styles.metrics}>
          Shoulder difference: {result ? `${result.details.shoulderDiff}°` : 'Select keypoints first'}
        </Text>

        <Text style={styles.issuesTitle}>Findings</Text>
        {!result && <Text style={styles.issueText}>Select left shoulder, right shoulder, and neck.</Text>}
        {result?.issues.map((issue) => {
          const good = issue.toLowerCase().includes('great posture');
          return (
            <View key={issue} style={styles.issueRow}>
              <View style={[styles.dot, { backgroundColor: good ? '#22c55e' : '#ef4444' }]} />
              <Text style={styles.issueText}>{issue}</Text>
            </View>
          );
        })}
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
  instructionTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 18,
    alignSelf: 'flex-start'
  },
  instructionText: {
    color: '#cbd5e1',
    alignSelf: 'flex-start'
  },
  autoText: {
    color: '#94a3b8',
    alignSelf: 'flex-start',
    fontSize: 12
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
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#052e16',
    position: 'absolute'
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
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  scoreLabel: {
    color: '#94a3b8',
    fontSize: 14
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 72
  },
  metrics: {
    color: '#cbd5e1',
    fontSize: 15
  },
  issuesTitle: {
    marginTop: 8,
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700'
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
  }
});
