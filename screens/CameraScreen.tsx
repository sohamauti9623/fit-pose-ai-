import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';

type Props = StackScreenProps<RootStackParamList, 'Camera'>;

export default function CameraScreen({ navigation }: Props) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Camera access is required to scan posture.</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) {
      return;
    }

    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });

      if (photo?.uri) {
        navigation.navigate('Result', { imageUri: photo.uri });
      }
    } catch (error) {
      console.warn('Capture failed:', error);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={CameraType.back}>
        <View style={styles.overlay}>
          <Pressable style={styles.captureButton} onPress={handleCapture}>
            <View style={styles.captureInner} />
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  camera: {
    flex: 1
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 34,
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center'
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22c55e'
  },
  centered: {
    flex: 1,
    backgroundColor: '#0b1220',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24
  },
  permissionText: {
    color: '#f8fafc',
    textAlign: 'center',
    fontSize: 16
  },
  permissionButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18
  },
  permissionButtonText: {
    color: '#052e16',
    fontWeight: '700'
  }
});
