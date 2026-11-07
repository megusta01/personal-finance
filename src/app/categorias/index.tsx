import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  CategoryIcon,
  Divider,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  Segmented,
  Surface,
  Text,
} from '@/components/ui';
import { useDbQuery } from '@/db/client';
import type { CategoryKind } from '@/db/schema';
import {
  CATEGORY_TABLES,
  listCategoryTree,
  type CategoryNode,
} from '@/features/categories/repository';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Categorias() {
  const { colors } = useTheme();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useDbQuery(
    (db) => ({
      active: listCategoryTree(db, kind),
      archived: listCategoryTree(db, kind, { archived: true }),
    }),
    CATEGORY_TABLES,
    [kind],
  );

  return (
    <Screen
      back
      title="Categorias"
      right={
        <IconButton
          icon="add"
          label="Nova categoria"
          background={colors.brandSoft}
          color={colors.brand}
          onPress={() => router.push({ pathname: '/categorias/nova', params: { tipo: kind } })}
        />
      }
    >
      <Segmented
        accessibilityLabel="Tipo de categoria"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Despesas' },
          { value: 'income', label: 'Receitas' },
        ]}
      />

      <Text variant="caption" tone="muted">
        Toque para editar. Subcategorias são opcionais e ajudam a detalhar, por exemplo, Alimentação
        em Restaurante e Delivery.
      </Text>

      <Surface>
        {data?.active.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <Divider />}
            <CategoryBlock category={c} />
          </View>
        ))}
      </Surface>

      {(data?.archived.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Arquivadas" />
          <Surface>
            <ListRow
              title={
                showArchived
                  ? 'Esconder arquivadas'
                  : `Mostrar ${data!.archived.length} arquivada${data!.archived.length > 1 ? 's' : ''}`
              }
              tone="muted"
              chevron={false}
              onPress={() => setShowArchived((v) => !v)}
            />
            {showArchived &&
              data!.archived.map((c) => (
                <View key={c.id}>
                  <Divider inset={68} />
                  <ListRow
                    title={c.name}
                    subtitle={c.parentId ? 'Subcategoria' : undefined}
                    tone="muted"
                    left={<CategoryIcon icon={c.icon} color={c.color} />}
                    onPress={() => router.push(`/categorias/${c.id}`)}
                  />
                </View>
              ))}
          </Surface>
        </>
      )}
    </Screen>
  );
}

function CategoryBlock({ category: c }: { category: CategoryNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <ListRow
        title={c.name}
        subtitle={
          c.children.length
            ? `${c.children.length} subcategoria${c.children.length > 1 ? 's' : ''}`
            : undefined
        }
        left={<CategoryIcon icon={c.icon} color={c.color} />}
        onPress={() => router.push(`/categorias/${c.id}`)}
      />
      {c.children.map((s) => (
        <ListRow
          key={s.id}
          title={s.name}
          left={
            <View style={{ width: 40, alignItems: 'center' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.color }} />
            </View>
          }
          onPress={() => router.push(`/categorias/${s.id}`)}
        />
      ))}
      <ListRow
        title="Adicionar subcategoria"
        tone="muted"
        chevron={false}
        left={
          <View style={{ width: 40, alignItems: 'center' }}>
            <Ionicons name="add" size={18} color={colors.brand} />
          </View>
        }
        onPress={() =>
          router.push({ pathname: '/categorias/nova', params: { tipo: c.kind, pai: c.id } })
        }
      />
      <View style={{ height: space.xs }} />
    </View>
  );
}
