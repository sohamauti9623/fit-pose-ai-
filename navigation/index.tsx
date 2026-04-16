import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import CameraScreen from '../screens/CameraScreen';
import ResultScreen from '../screens/ResultScreen';

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: { imageUri: string };
};

const Stack = createStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0b1220',
    card: '#111827',
    text: '#f8fafc',
    border: '#1f2937'
  }
};

export default function RootNavigation() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#f8fafc',
          headerTitleStyle: { fontWeight: '700' },
          cardStyle: { backgroundColor: '#0b1220' }
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'FitPose AI' }} />
        <Stack.Screen name="Camera" component={CameraScreen} options={{ title: 'Scan Posture' }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Result' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
