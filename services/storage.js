import { openDatabase } from './database';

export async function salvarTransacao(descricao, valor, tipo) {
  const db = await openDatabase();
  
  // Captura a data e horário atuais
  const agora = new Date();
  const dataFormatada = `${agora.toLocaleDateString()} ${agora.toLocaleTimeString()}`; // Ex: "12/03/2025 14:30"

  await db.runAsync(
    'INSERT INTO transacoes (descricao, valor, tipo, data) VALUES (?, ?, ?, ?)',
    [descricao, valor, tipo, dataFormatada] // 🔥 Agora salvamos data e horário
  );

  console.log('Transação salva com sucesso!');
}



// Carregar todas as transações
export async function carregarTransacoes() {
  const db = await openDatabase();
  return await db.getAllAsync('SELECT * FROM transacoes ORDER BY id DESC'); // 🔥 Ordena do mais recente para o mais antigo
}


// Atualizar uma transação
export async function atualizarTransacao(id, descricao, valor, tipo) {
  const db = await openDatabase();
  await db.runAsync(
    'UPDATE transacoes SET descricao = ?, valor = ?, tipo = ? WHERE id = ?',
    descricao, valor, tipo, id
  );
}

// Excluir uma transação
export async function excluirTransacao(id) {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM transacoes WHERE id = ?', id);
}
