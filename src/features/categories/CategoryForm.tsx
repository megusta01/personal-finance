import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  CategoryIcon,
  ColorPicker,
  ConfirmDialog,
  Field,
  FormLayout,
  IconPicker,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useDb } from '@/db/client';
import type { Category, CategoryKind } from '@/db/schema';
import { space } from '@/theme/tokens';
import { CATEGORY_COLORS, CATEGORY_ICONS } from './meta';
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  unarchiveCategory,
  updateCategory,
} from './repository';

type Props =
  | { mode: 'create'; kind: CategoryKind; parent?: Category }
  | { mode: 'edit'; category: Category; parent?: Category; usage: number };

export function CategoryForm(props: Props) {
  const db = useDb();
  const toast = useToast();
  const editing = props.mode === 'edit' ? props.category : undefined;
  const parent = props.parent;
  const isSub = !!parent;
  const kind = editing?.kind ?? (props.mode === 'create' ? props.kind : 'expense');

  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? parent?.icon ?? CATEGORY_ICONS[0]!);
  const [color, setColor] = useState(editing?.color ?? parent?.color ?? CATEGORY_COLORS[9]!);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);

  const kindLabel = kind === 'expense' ? 'despesa' : 'receita';
  const title = editing
    ? isSub
      ? 'Editar subcategoria'
      : 'Editar categoria'
    : isSub
      ? `Nova subcategoria em ${parent!.name}`
      : `Nova categoria de ${kindLabel}`;

  const save = () => {
    try {
      if (editing) updateCategory(db, editing.id, { name, icon, color });
      else createCategory(db, { name, kind, icon, color, parentId: parent?.id });
      toast({
        message: editing
          ? 'Categoria atualizada'
          : isSub
            ? 'Subcategoria criada'
            : 'Categoria criada',
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const run = (action: 'archive' | 'unarchive' | 'delete') => {
    if (!editing) return;
    try {
      if (action === 'archive') archiveCategory(db, editing.id);
      if (action === 'unarchive') unarchiveCategory(db, editing.id);
      if (action === 'delete') deleteCategory(db, editing.id);
      setConfirm(null);
      toast({
        message:
          action === 'archive'
            ? 'Categoria arquivada'
            : action === 'unarchive'
              ? 'Categoria reativada'
              : 'Categoria excluída',
      });
      router.back();
    } catch (e) {
      setConfirm(null);
      setError((e as Error).message);
    }
  };

  const usage = props.mode === 'edit' ? props.usage : 0;

  return (
    <FormLayout
      title={title}
      onClose={() => router.back()}
      footer={
        <>
          {error && (
            <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          <Button
            size="lg"
            label={editing ? 'Salvar alterações' : isSub ? 'Criar subcategoria' : 'Criar categoria'}
            disabled={!name.trim()}
            onPress={save}
          />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <CategoryIcon icon={icon} color={color} size={64} />
        {isSub && (
          <Text variant="caption" tone="muted" align="center">
            Subcategorias usam o ícone e a cor de {parent!.name}.
          </Text>
        )}
      </View>

      <TextField
        label="Nome"
        placeholder={isSub ? 'Ex.: Delivery' : 'Ex.: Academia'}
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        maxLength={30}
        autoFocus={!editing}
      />

      {!isSub && (
        <>
          <Field label="Cor">
            <ColorPicker colors={CATEGORY_COLORS} value={color} onChange={setColor} />
          </Field>
          <Field label="Ícone">
            <IconPicker icons={CATEGORY_ICONS} value={icon} color={color} onChange={setIcon} />
          </Field>
        </>
      )}

      {editing && (
        <View style={{ gap: space.sm }}>
          <Text variant="caption" tone="subtle" align="center">
            {usage === 0
              ? 'Ainda não usada em nenhuma movimentação.'
              : `Usada em ${usage} movimentaç${usage > 1 ? 'ões' : 'ão'}${isSub ? '' : ' (somando as subcategorias)'}.`}
          </Text>
          {editing.archivedAt ? (
            <Button
              label="Reativar"
              variant="secondary"
              icon="refresh"
              onPress={() => run('unarchive')}
            />
          ) : (
            <Button
              label="Arquivar"
              variant="secondary"
              icon="archive-outline"
              onPress={() => setConfirm('archive')}
            />
          )}
          {usage === 0 && (
            <Button
              label="Excluir"
              variant="danger"
              icon="trash-outline"
              onPress={() => setConfirm('delete')}
            />
          )}
        </View>
      )}

      <ConfirmDialog
        visible={confirm === 'archive'}
        title="Arquivar esta categoria?"
        message={
          isSub
            ? 'Ela deixa de aparecer na hora de lançar. O histórico continua igual.'
            : 'Ela e as subcategorias deixam de aparecer na hora de lançar. O histórico continua igual.'
        }
        confirmLabel="Arquivar"
        onConfirm={() => run('archive')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'delete'}
        title="Excluir esta categoria?"
        message={
          isSub
            ? 'Ela não tem movimentações e será removida.'
            : 'Ela e as subcategorias não têm movimentações e serão removidas.'
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => run('delete')}
        onCancel={() => setConfirm(null)}
      />
    </FormLayout>
  );
}
