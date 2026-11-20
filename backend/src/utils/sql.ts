/**
 * Будує частину SET для часткового UPDATE.
 * Імена колонок беруться ЛИШЕ зі сталого allowlist, значення завжди йдуть параметрами ($n),
 * тому SQL-ін'єкція через ключі тіла запиту неможлива.
 */
export interface UpdateParts {
  setClause: string;
  values: unknown[];
}

export function buildUpdate(
  allowed: readonly string[],
  data: Record<string, unknown>,
  options: { jsonColumns?: readonly string[] } = {},
): UpdateParts | null {
  const json = new Set(options.jsonColumns ?? []);
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const column of allowed) {
    const value = data[column];
    if (value === undefined) continue;
    values.push(json.has(column) ? JSON.stringify(value) : value);
    sets.push(`${column} = $${values.length}${json.has(column) ? '::jsonb' : ''}`);
  }

  if (sets.length === 0) return null;
  return { setClause: sets.join(', '), values };
}
