import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const CurrencyCard = ({ item, saldo }) => {
  return (
    <View style={styles.moedaCard}>
      <Text style={styles.moedaNome}>
        {item.simbolo} {item.nome}
      </Text>
      <Text style={styles.moedaCotacao}>
        <Text style={styles.moedaDestaque}> R$ {item.valor?.toFixed(2)} </Text> = 1{item.sigla}
      </Text>
      <Text style={styles.moedaConvertido}>
        <Text style={styles.moedaDestaque}>{saldo.toFixed(2)} BRL</Text> = {(saldo / item.valor).toFixed(4)} {item.sigla}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  moedaCard: {
    backgroundColor: '#333',
    marginTop: 40,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    width: Dimensions.get('window').width * 0.45,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  moedaNome: {
    fontSize: 18,
    color: '#FFD700',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  moedaCotacao: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
    textAlign: 'center',
  },
  moedaConvertido: {
    fontSize: 13,
    color: '#A0A0A0',
    textAlign: 'center',
  },
  moedaDestaque: {
    fontSize: 15,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});

export default CurrencyCard;
