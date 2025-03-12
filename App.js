import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import { initializeDatabase } from './services/database';

export default function App() {
  useEffect(() => {
    async function setupDatabase() {
      await initializeDatabase();
    }
    setupDatabase();
  }, []);

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
