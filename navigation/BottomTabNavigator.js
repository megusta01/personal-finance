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
        headerShown: false, // Remove o cabeçalho padrão
        tabBarActiveTintColor: '#FF4500', // Cor do ícone ativo
        tabBarInactiveTintColor: 'gray', // Cor do ícone inativo
        tabBarStyle: {
          backgroundColor: '#1C1C1C', // Cor de fundo da barra
          borderTopWidth: 0, // Remove a borda superior
          paddingBottom: 5, // Ajuste do padding inferior
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
