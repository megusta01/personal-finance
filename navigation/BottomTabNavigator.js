import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import Dashboard from '../screens/dashboard';
import Transacoes from '../screens/transacoes';
import Historico from '../screens/historico';

const Tab = createBottomTabNavigator();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, 
        tabBarActiveTintColor: '#FF4500', 
        tabBarInactiveTintColor: 'gray', 
        tabBarStyle: {
          backgroundColor: '#1C1C1C', 
          borderTopWidth: 0, 
          paddingBottom: 5,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') iconName = 'home-outline';
          else if (route.name === 'Transações') iconName = 'cash-outline';
          else if (route.name === 'Histórico') iconName = 'list-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={Dashboard} />
      <Tab.Screen name="Transações" component={Transacoes} />
      <Tab.Screen name="Histórico" component={Historico} />
    </Tab.Navigator>
  );
}
