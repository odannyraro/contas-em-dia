export const DEMO_STORAGE_KEY = 'contas-em-dia-demo-data-v1';

const USERS = [
  {
    id: 'maria',
    name: 'Maria Fernandes',
    email: 'maria@contas.local',
    password: 'familia123',
    role: 'ADMIN',
    familyId: 'familia-fernandes'
  },
  {
    id: 'jonas',
    name: 'Jonas Fernandes',
    email: 'jonas@contas.local',
    password: 'familia123',
    role: 'PARTICIPANT',
    familyId: 'familia-fernandes'
  },
  {
    id: 'rafael',
    name: 'Rafael Fernandes',
    email: 'rafael@contas.local',
    password: 'familia123',
    role: 'PARTICIPANT',
    familyId: 'familia-fernandes'
  }
];

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function dateInCurrentMonth(day) {
  return `${currentMonth()}-${String(day).padStart(2, '0')}`;
}

function createInitialState() {
  return {
    families: [
      {
        id: 'familia-fernandes',
        name: 'Família Fernandes',
        categories: [
          { id: 'alimentacao', name: 'Alimentação', budgetCents: 120000 },
          { id: 'moradia', name: 'Moradia', budgetCents: 180000 },
          { id: 'transporte', name: 'Transporte', budgetCents: 65000 },
          { id: 'lazer', name: 'Lazer', budgetCents: 40000 },
          { id: 'educacao', name: 'Educação', budgetCents: 50000 }
        ],
        goals: [
          {
            id: 'reserva-emergencia',
            name: 'Fundo de emergência',
            currentCents: 85000,
            targetCents: 200000
          }
        ]
      }
    ],
    transactions: [
      {
        id: 'seed-1', familyId: 'familia-fernandes', userId: 'maria',
        type: 'income', description: 'Salário', amountCents: 420000,
        categoryId: null, date: dateInCurrentMonth(2), notes: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'seed-2', familyId: 'familia-fernandes', userId: 'rafael',
        type: 'expense', description: 'Compras do mês', amountCents: 92000,
        categoryId: 'alimentacao', date: dateInCurrentMonth(4), notes: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'seed-3', familyId: 'familia-fernandes', userId: 'maria',
        type: 'expense', description: 'Aluguel', amountCents: 180000,
        categoryId: 'moradia', date: dateInCurrentMonth(5), notes: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'seed-4', familyId: 'familia-fernandes', userId: 'jonas',
        type: 'expense', description: 'Lanche na escola', amountCents: 1500,
        categoryId: 'alimentacao', date: dateInCurrentMonth(7), notes: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'seed-5', familyId: 'familia-fernandes', userId: 'rafael',
        type: 'expense', description: 'Transporte', amountCents: 28000,
        categoryId: 'transporte', date: dateInCurrentMonth(8), notes: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'seed-6', familyId: 'familia-fernandes', userId: 'maria',
        type: 'expense', description: 'Cinema em família', amountCents: 32000,
        categoryId: 'lazer', date: dateInCurrentMonth(10), notes: '',
        createdAt: new Date().toISOString()
      }
    ]
  };
}

function readState(storage) {
  const serialized = storage.getItem(DEMO_STORAGE_KEY);
  if (!serialized) {
    throw new Error('Os dados de demonstração ainda não foram inicializados.');
  }

  let state;
  try {
    state = JSON.parse(serialized);
  } catch {
    throw new Error('Os dados locais da demonstração estão inválidos. Restaure a demonstração.');
  }
  if (!state || !Array.isArray(state.families) || !Array.isArray(state.transactions)) {
    throw new Error('Os dados locais da demonstração estão incompletos. Restaure a demonstração.');
  }
  return state;
}

function writeState(storage, state) {
  try {
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    throw new Error(`Não foi possível salvar os dados de demonstração neste navegador: ${error.message}`);
  }
}

export function initializeDemoData(storage = globalThis.localStorage) {
  if (storage.getItem(DEMO_STORAGE_KEY) === null) {
    writeState(storage, createInitialState());
  } else {
    readState(storage);
  }
}

export function resetDemoData(storage = globalThis.localStorage) {
  writeState(storage, createInitialState());
}

export function signInDemoUser(email, password) {
  const user = USERS.find((candidate) =>
    candidate.email === String(email).trim().toLowerCase() &&
    candidate.password === password);
  if (!user) {
    throw new Error('E-mail ou senha inválidos.');
  }
  const { id, name, role, familyId } = user;
  return { id, name, email: user.email, role, familyId };
}

export function getDemoOverview(userId, month = currentMonth(), storage = globalThis.localStorage) {
  const user = USERS.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new Error('Conta de demonstração não encontrada. Entre novamente.');
  }

  const state = readState(storage);
  const family = state.families.find((candidate) => candidate.id === user.familyId);
  if (!family) {
    throw new Error('Família de demonstração não encontrada.');
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
    USERS.filter((member) => member.familyId === family.id)
      .map((member) => [member.id, member.name])
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

  const { password: _password, ...publicUser } = user;
  return {
    family: { id: family.id, name: family.name },
    user: publicUser,
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
      member: membersById.get(transaction.userId) ?? 'Membro',
      categoryName: categoriesById.get(transaction.categoryId) ??
        (transaction.type === 'income' ? 'Receita' : 'Sem categoria')
    }))
  };
}

export function addDemoTransaction(userId, input, storage = globalThis.localStorage) {
  const user = USERS.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new Error('Conta de demonstração não encontrada. Entre novamente.');
  }

  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const date = input.date;
  if (!description || description.length > 100) {
    throw new Error('Informe uma descrição com até 100 caracteres.');
  }
  if (!Number.isSafeInteger(input.amountCents) ||
      input.amountCents < 1 ||
      input.amountCents > 100_000_000) {
    throw new Error('Informe um valor válido, maior que zero e de até R$ 1.000.000,00.');
  }
  if (input.type !== 'expense' && input.type !== 'income') {
    throw new Error('O tipo deve ser despesa ou receita.');
  }
  if (typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)) ||
      new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    throw new Error('Informe uma data válida.');
  }
  if (notes.length > 240) {
    throw new Error('As observações devem ter até 240 caracteres.');
  }

  const state = readState(storage);
  const family = state.families.find((candidate) => candidate.id === user.familyId);
  let categoryId = null;
  if (input.type === 'expense') {
    if (typeof input.categoryId !== 'string' ||
        !family.categories.some((category) => category.id === input.categoryId)) {
      throw new Error('Selecione uma categoria válida para a despesa.');
    }
    categoryId = input.categoryId;
  }

  state.transactions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    familyId: family.id,
    userId: user.id,
    type: input.type,
    description,
    amountCents: input.amountCents,
    categoryId,
    date,
    notes,
    createdAt: new Date().toISOString()
  });
  writeState(storage, state);
}

export function updateDemoCategoryBudget(userId, categoryId, budgetCents, storage = globalThis.localStorage) {
  const user = USERS.find((candidate) => candidate.id === userId);
  if (!user || user.role !== 'ADMIN') {
    throw new Error('Somente administradores podem alterar os limites.');
  }
  if (!Number.isSafeInteger(budgetCents) ||
      budgetCents < 0 ||
      budgetCents > 100_000_000) {
    throw new Error('O limite deve ser um valor entre R$ 0,00 e R$ 1.000.000,00.');
  }

  const state = readState(storage);
  const family = state.families.find((candidate) => candidate.id === user.familyId);
  const category = family.categories.find((candidate) => candidate.id === categoryId);
  if (!category) {
    throw new Error('Categoria não encontrada.');
  }
  category.budgetCents = budgetCents;
  writeState(storage, state);
}
