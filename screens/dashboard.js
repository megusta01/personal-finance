import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, ScrollView, FlatList } from 'react-native';
import { carregarTransacoes } from '../services/storage';
import { getCotacoes } from '../services/api'; // API para múltiplas cotações
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';

export default function Dashboard() {
  const [cotacoes, setCotacoes] = useState(null);
  const [saldo, setSaldo] = useState(0);
  const [transacoes, setTransacoes] = useState([]);
  const [loading, setLoading] = useState(true);

useFocusEffect(
  useCallback(() => {
    let interval;

    async function fetchData() {
      try {
        setLoading(true);
        const dadosCotacoes = await getCotacoes(); 
        setCotacoes(dadosCotacoes);

        const dadosTransacoes = await carregarTransacoes();
        setTransacoes(dadosTransacoes);

        const saldoAtual = dadosTransacoes.reduce(
          (acc, item) => acc + (item.tipo === 'receita' ? item.valor : -item.valor),
          0
        );
        setSaldo(saldoAtual);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData(); 

    interval = setInterval(fetchData, 1800000);

    return () => {
      clearInterval(interval); 
    };
  }, [])
);


  const { dataReceitas, dataDespesas, dataLabels } = useMemo(() => {
    let acumuladoReceita = 0;
    let acumuladoDespesa = 0;
    const receitasCalc = [];
    const despesasCalc = [];
    const labelsCalc = [];

    const transacoesOrdenadas = [...transacoes].reverse(); 

    transacoesOrdenadas.forEach((t, idx) => {
      if (t.tipo === 'receita') {
        acumuladoReceita += t.valor;
      } else {
        acumuladoDespesa += t.valor;
      }
      receitasCalc.push(acumuladoReceita);
      despesasCalc.push(acumuladoDespesa);
      labelsCalc.push(`T${idx + 1}`);
    });

    return { dataReceitas: receitasCalc, dataDespesas: despesasCalc, dataLabels: labelsCalc };
  }, [transacoes]);

  const chartData = {
    labels: dataLabels,
    datasets: [
      {
        data: dataReceitas,
        color: (opacity = 1) => `rgba(255, 165, 0, ${opacity})`, 
        strokeWidth: 2,
      },
      {
        data: dataDespesas,
        color: (opacity = 1) => `rgba(30, 144, 255, ${opacity})`, 
        strokeWidth: 2,
      },
    ],
    legend: ['Receita', 'Despesa'],
  };

  const screenWidth = Dimensions.get('window').width - 32;

  // Lista de moedas para o carrossel
  const moedas = [
    { nome: 'Dólar', sigla: 'USD', valor: cotacoes?.usd, simbolo: '💵' },
    { nome: 'Euro', sigla: 'EUR', valor: cotacoes?.eur, simbolo: '💶' },
    { nome: 'Libra', sigla: 'GBP', valor: cotacoes?.gbp, simbolo: '💷' },
    { nome: 'Bitcoin', sigla: 'BTC', valor: cotacoes?.btc, simbolo: '₿' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        
        {/* 🔥 Exibição do Saldo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saldo</Text>
          <Text style={styles.balanceValue}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldo)}
          </Text>
        </View>

                {/* 🔥 Gráfico de Transações */}
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
            <Text style={styles.chartMessage}>Sem dados suficientes para gerar o gráfico.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Cotação das Moedas</Text>
{loading ? (
  <ActivityIndicator size="large" color="#00aced" />
) : (
  <FlatList
    data={moedas}
    horizontal
    keyExtractor={(item) => item.sigla}
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.carouselContainer}
    snapToAlignment="center"
    decelerationRate="fast"
    renderItem={({ item }) => (
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
    )}
  />
)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#1E1E1E',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },

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
  sectionTitle: {
    marginTop: 20,
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },

  carouselContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
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

