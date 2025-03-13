import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BalanceCard = ({ saldo }) => {
  const formattedSaldo = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldo);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Saldo</Text>
      <Text style={styles.balanceValue}>{formattedSaldo}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 50,
    backgroundColor: '#292929',
    borderRadius: 12,
    padding: 18,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  balanceValue: {
    fontSize: 28,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});

export default BalanceCard;
