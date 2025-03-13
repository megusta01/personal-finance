// components/TransactionsChart.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const TransactionsChart = ({ chartData, screenWidth, dataLabels }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Gráfico de Transações</Text>
      {dataLabels.length > 0 ? (
        <LineChart
          data={chartData}
          width={screenWidth}
          height={220}
          chartConfig={{
            backgroundColor: '#222',
            backgroundGradientFrom: '#222',
            backgroundGradientTo: '#222',
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            propsForDots: {
              r: '3',
              strokeWidth: '2',
              stroke: '#ffa726',
            },
          }}
          bezier
          style={styles.chartStyle}
        />
      ) : (
        <Text style={styles.chartMessage}>
          Sem dados suficientes para gerar o gráfico.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
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
  chartStyle: {
    borderRadius: 16,
  },
  chartMessage: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default TransactionsChart;
