import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Grava um arquivo temporário e abre o "Compartilhar" do sistema (salvar no Drive, mandar no WhatsApp…). */
export async function saveAndShare(
  fileName: string,
  content: string,
  mimeType: string,
  dialogTitle: string,
) {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(content);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Compartilhamento indisponível neste aparelho.');
  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle,
    UTI: mimeType === 'application/json' ? 'public.json' : 'public.comma-separated-values-text',
  });
}

/** Abre o seletor de arquivos e devolve o texto do arquivo escolhido (ou null se cancelar). */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  return new File(result.assets[0].uri).text();
}
