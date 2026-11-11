import { randomUUID } from 'node:crypto';

export class InputError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function buildOverview(state, user, month) {
  const family = state.families.find((item) => item.id === user.familyId);

  if (!family) {
    throw new InputError('Família não encontrada.', 404);
  }

  const categories = family.categories.map((category) => {
    const spentCents = state.transactions
      .filter((transaction) =>
        transaction.familyId === family.id &&
        transaction.type === 'expense' &&
        transaction.categoryId === category.id &&
        transaction.date.startsWith(month))
      .reduce((total, transaction) => total + transaction.amountCents, 0);

    return {
      ...category,
      spentCents,
      percent: category.budgetCents === 0
        ? 0
        : Math.round((spentCents / category.budgetCents) * 100)
    };
  });

  const monthTransactions = state.transactions
    .filter((transaction) =>
      transaction.familyId === family.id && transaction.date.startsWith(month))
    .sort((left, right) =>
      right.date.localeCompare(left.date) ||
      right.createdAt.localeCompare(left.createdAt));

  const expensesCents = monthTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + transaction.amountCents, 0);
  const incomeCents = monthTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + transaction.amountCents, 0);
  const budgetCents = categories.reduce(
    (total, category) => total + category.budgetCents,
    0
  );
  const membersById = new Map(
    state.users
      .filter((member) => member.familyId === family.id)
      .map((member) => [member.id, { id: member.id, name: member.name, role: member.role }])
  );
  const categoriesById = new Map(categories.map((category) => [category.id, category.name]));

  const notifications = categories
    .filter((category) => category.budgetCents > 0 && category.percent >= 80)
    .map((category) => ({
      id: category.id,
      level: category.percent > 100 ? 'over' : 'warning',
      message: category.percent > 100
        ? `${category.name} ultrapassou o limite em ${category.percent - 100}%.`
        : category.percent === 100
          ? `${category.name} atingiu 100% do limite.`
          : `${category.name} já consumiu ${category.percent}% do limite.`
    }));

  return {
    family: { id: family.id, name: family.name },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    month,
    budget: {
      limitCents: budgetCents,
      spentCents: expensesCents,
      remainingCents: budgetCents - expensesCents,
      percent: budgetCents === 0 ? 0 : Math.round((expensesCents / budgetCents) * 100)
    },
    incomeCents,
    categories,
    notifications,
    goals: family.goals,
    transactions: monthTransactions.slice(0, 12).map((transaction) => ({
      ...transaction,
      member: membersById.get(transaction.userId)?.name ?? 'Membro',
      categoryName: categoriesById.get(transaction.categoryId) ??
        (transaction.type === 'income' ? 'Receita' : 'Sem categoria')
    }))
  };
}

export function createTransaction(input, user, family) {
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const date = input.date;

  if (!description || description.length > 100) {
    throw new InputError('Informe uma descrição com até 100 caracteres.');
  }
  if (!Number.isSafeInteger(input.amountCents) ||
      input.amountCents < 1 ||
      input.amountCents > 100_000_000) {
    throw new InputError('Informe um valor válido, maior que zero e de até R$ 1.000.000,00.');
  }
  if (input.type !== 'expense' && input.type !== 'income') {
    throw new InputError('O tipo deve ser despesa ou receita.');
  }
  if (typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)) ||
      new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    throw new InputError('Informe uma data válida.');
  }
  if (notes.length > 240) {
    throw new InputError('As observações devem ter até 240 caracteres.');
  }

  let categoryId = null;
  if (input.type === 'expense') {
    if (typeof input.categoryId !== 'string' ||
        !family.categories.some((category) => category.id === input.categoryId)) {
      throw new InputError('Selecione uma categoria válida para a despesa.');
    }
    categoryId = input.categoryId;
  }

  return {
    id: randomUUID(),
    familyId: family.id,
    userId: user.id,
    type: input.type,
    description,
    amountCents: input.amountCents,
    categoryId,
    date,
    notes,
    createdAt: new Date().toISOString()
  };
}

export function updateCategoryBudget(family, categoryId, budgetCents) {
  if (!Number.isSafeInteger(budgetCents) ||
      budgetCents < 0 ||
      budgetCents > 100_000_000) {
    throw new InputError('O limite deve ser um valor entre R$ 0,00 e R$ 1.000.000,00.');
  }

  const category = family.categories.find((item) => item.id === categoryId);
  if (!category) {
    throw new InputError('Categoria não encontrada.', 404);
  }

  category.budgetCents = budgetCents;
}
