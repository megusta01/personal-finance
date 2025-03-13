import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import BottomTabNavigator from './BottomTabNavigator'; 
import Transacoes from '../screens/transacoes'; 

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FF4500',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen name="Home" component={BottomTabNavigator} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
