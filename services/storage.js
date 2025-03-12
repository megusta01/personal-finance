import { openDatabase } from './database';

// Salvar transação no banco de dados
export async function salvarTransacao(descricao, valor, tipo) {
  const db = await openDatabase();
  const data = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO transacoes (descricao, valor, tipo, data) VALUES (?, ?, ?, ?)',
    descricao, valor, tipo, data
  );

  console.log('Transação salva com sucesso!');
}

// Carregar todas as transações
export async function carregarTransacoes() {
  const db = await openDatabase();
  return await db.getAllAsync('SELECT * FROM transacoes');
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
