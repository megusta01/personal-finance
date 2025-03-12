import axios from 'axios';

const api = axios.create({
  baseURL: 'https://economia.awesomeapi.com.br/json/',
});

export const getCotacaoDolar = async () => {
  try {
    const response = await api.get('last/USD-BRL');
    return parseFloat(response.data.USDBRL.bid);
  } catch (error) {
    console.error('Erro ao buscar cotação do dólar:', error);
    return null;
  }
};

export default api;
