import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import CurrencyCard from './CurrencyCard';

const CurrencyCarousel = ({ moedas, saldo }) => {
  return (
    <FlatList
      data={moedas}
      horizontal
      keyExtractor={(item) => item.sigla}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.carouselContainer}
      snapToAlignment="center"
      decelerationRate="fast"
      renderItem={({ item }) => <CurrencyCard item={item} saldo={saldo} />}
    />
  );
};

const styles = StyleSheet.create({
  carouselContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
});

export default CurrencyCarousel;
