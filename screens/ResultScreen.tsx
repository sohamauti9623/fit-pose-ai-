import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { analyzePosture, generateMockKeypoints } from '../utils/postureAnalysis';

type Props = StackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ route }: Props) {
  const { imageUri } = route.params;

  const result = useMemo(() => {
    const keypoints = generateMockKeypoints();
    return analyzePosture(keypoints);
  }, [imageUri]);

  const scoreColor = result.score >= 80 ? '#22c55e' : '#ef4444';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.preview} />

      <View style={styles.card}>
        <Text style={styles.scoreLabel}>Posture Score</Text>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{result.score}</Text>

        <Text style={styles.metrics}>Neck angle: {result.neckAngle}°</Text>
        <Text style={styles.metrics}>Shoulder difference: {result.shoulderDifference}°</Text>

        <Text style={styles.issuesTitle}>Findings</Text>
        {result.issues.map((issue) => {
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
    gap: 16
  },
  preview: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 3 / 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1f2937'
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
