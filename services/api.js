import axios from 'axios';

const api = axios.create({
  baseURL: 'https://economia.awesomeapi.com.br/json/',
});

// Buscar cotações de várias moedas
export const getCotacoes = async () => {
  try {
    const response = await api.get('last/USD-BRL,EUR-BRL,GBP-BRL,BTC-BRL');
    return {
      usd: parseFloat(response.data.USDBRL.bid),
      eur: parseFloat(response.data.EURBRL.bid),
      gbp: parseFloat(response.data.GBPBRL.bid),
      btc: parseFloat(response.data.BTCBRL.bid),
    };
  } catch (error) {
    console.error('Erro ao buscar cotações:', error);
    return null;
  }
};


export default api;
