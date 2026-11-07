import { Redirect } from 'expo-router';

/** Rota só para reservar o espaço do botão "+" na barra; o toque abre /transacao/nova. */
export default function Novo() {
  return <Redirect href="/transacao/nova" />;
}
