import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import PrimaryButton from '../components/PrimaryButton';

type Props = StackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FitPose AI</Text>
      <Text style={styles.subtitle}>Take a quick photo and get a posture score in seconds.</Text>
      <PrimaryButton label="Scan Your Posture" onPress={() => navigation.navigate('Camera')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 18
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#f8fafc'
  },
  subtitle: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 14,
    fontSize: 16,
    lineHeight: 24
  }
});
