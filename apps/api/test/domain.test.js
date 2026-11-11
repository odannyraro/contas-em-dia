import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverview, createTransaction, InputError, updateCategoryBudget } from '../src/domain.js';

const family = {
  id: 'family-1',
  name: 'Família de teste',
  categories: [
    { id: 'food', name: 'Alimentação', budgetCents: 10000 },
    { id: 'home', name: 'Moradia', budgetCents: 20000 }
  ],
  goals: [{ id: 'goal-1', name: 'Reserva', currentCents: 5000, targetCents: 10000 }]
};
const admin = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@example.test',
  role: 'ADMIN',
  familyId: family.id
};
const participant = {
  id: 'member-1',
  name: 'Participante',
  role: 'PARTICIPANT',
  familyId: family.id
};

test('overview aggregates the selected month and flags categories near their limit', () => {
  const overview = buildOverview({
    families: [family],
    users: [admin, participant],
    transactions: [
      {
        id: 'expense-1', familyId: family.id, userId: participant.id,
        type: 'expense', description: 'Mercado', amountCents: 8500,
        categoryId: 'food', date: '2026-11-05', createdAt: '2026-11-05T12:00:00.000Z'
      },
      {
        id: 'income-1', familyId: family.id, userId: admin.id,
        type: 'income', description: 'Salário', amountCents: 50000,
        categoryId: null, date: '2026-11-06', createdAt: '2026-11-06T12:00:00.000Z'
      },
      {
        id: 'other-month', familyId: family.id, userId: admin.id,
        type: 'expense', description: 'Conta', amountCents: 9000,
        categoryId: 'home', date: '2026-10-25', createdAt: '2026-10-25T12:00:00.000Z'
      }
    ]
  }, admin, '2026-11');

  assert.equal(overview.budget.limitCents, 30000);
  assert.equal(overview.budget.spentCents, 8500);
  assert.equal(overview.incomeCents, 50000);
  assert.equal(overview.categories[0].percent, 85);
  assert.equal(overview.notifications[0].level, 'warning');
  assert.equal(overview.transactions.length, 2);
});

test('a category exactly at its limit is not reported as exceeding it', () => {
  const overview = buildOverview({
    families: [family],
    users: [admin],
    transactions: [{
      id: 'expense-1', familyId: family.id, userId: admin.id,
      type: 'expense', description: 'Mercado', amountCents: 10000,
      categoryId: 'food', date: '2026-11-05', createdAt: '2026-11-05T12:00:00.000Z'
    }]
  }, admin, '2026-11');

  assert.equal(overview.notifications[0].level, 'warning');
  assert.equal(overview.notifications[0].message, 'Alimentação atingiu 100% do limite.');
});

test('participants can create categorized expenses and income without a category', () => {
  const expense = createTransaction({
    description: ' Lanche ',
    type: 'expense',
    amountCents: 560,
    categoryId: 'food',
    date: '2026-11-11'
  }, participant, family);
  const income = createTransaction({
    description: 'Mesada',
    type: 'income',
    amountCents: 1000,
    date: '2026-11-11'
  }, participant, family);

  assert.equal(expense.description, 'Lanche');
  assert.equal(expense.categoryId, 'food');
  assert.equal(income.categoryId, null);
});

test('transaction validation rejects invalid amounts, categories, and dates', () => {
  assert.throws(
    () => createTransaction({
      description: 'Compra', type: 'expense', amountCents: 0,
      categoryId: 'food', date: '2026-11-11'
    }, participant, family),
    InputError
  );
  assert.throws(
    () => createTransaction({
      description: 'Compra', type: 'expense', amountCents: 100,
      categoryId: 'missing', date: '2026-11-11'
    }, participant, family),
    InputError
  );
  assert.throws(
    () => createTransaction({
      description: 'Compra', type: 'expense', amountCents: 100,
      categoryId: 'food', date: '2026-02-30'
    }, participant, family),
    InputError
  );
});

test('category budget updates validate the limit and preserve category identity', () => {
  updateCategoryBudget(family, 'food', 15000);
  assert.equal(family.categories[0].budgetCents, 15000);
  assert.throws(() => updateCategoryBudget(family, 'food', -1), InputError);
  assert.throws(() => updateCategoryBudget(family, 'missing', 100), InputError);
});
