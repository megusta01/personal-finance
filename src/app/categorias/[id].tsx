import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { useDb } from '@/db/client';
import { CategoryForm } from '@/features/categories/CategoryForm';
import { categoryUsage, getCategory } from '@/features/categories/repository';
import { useTheme } from '@/theme/ThemeProvider';

export default function EditarCategoria() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { colors } = useTheme();
  const [state] = useState(() => {
    const category = id ? getCategory(db, id) : undefined;
    if (!category || category.isSystem) return null;
    return {
      category,
      parent: category.parentId ? getCategory(db, category.parentId) : undefined,
      usage: categoryUsage(db, category.id),
    };
  });

  if (!state) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Categoria não encontrada"
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }
  return <CategoryForm mode="edit" {...state} />;
}
