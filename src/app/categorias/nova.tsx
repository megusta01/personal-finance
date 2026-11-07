import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useDb } from '@/db/client';
import { CategoryForm } from '@/features/categories/CategoryForm';
import { getCategory } from '@/features/categories/repository';

/** Parâmetros: tipo (expense | income) e, para subcategoria, pai (id da categoria principal). */
export default function NovaCategoria() {
  const { tipo, pai } = useLocalSearchParams<{ tipo?: string; pai?: string }>();
  const db = useDb();
  const [parent] = useState(() => (pai ? getCategory(db, pai) : undefined));
  const kind = parent?.kind ?? (tipo === 'income' ? 'income' : 'expense');
  return <CategoryForm mode="create" kind={kind} parent={parent} />;
}
