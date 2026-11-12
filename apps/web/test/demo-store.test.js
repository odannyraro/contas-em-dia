import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDemoTransaction,
  DEMO_STORAGE_KEY,
  getDemoOverview,
  initializeDemoData,
  resetDemoData,
  signInDemoUser,
  updateDemoCategoryBudget
} from '../demo-store.js';

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function createStorage() {
  const storage = new MemoryStorage();
  initializeDemoData(storage);
  return storage;
}

test('demo credentials expose fictitious administrator and participant profiles', () => {
  assert.equal(signInDemoUser('maria@contas.local', 'familia123').role, 'ADMIN');
  assert.equal(signInDemoUser('jonas@contas.local', 'familia123').role, 'PARTICIPANT');
  assert.throws(() => signInDemoUser('maria@contas.local', 'wrong'), /inválidos/);
});

test('overview aggregates seeded family data and category alerts', () => {
  const storage = createStorage();
  const overview = getDemoOverview('maria', new Date().toISOString().slice(0, 7), storage);

  assert.equal(overview.family.name, 'Família Fernandes');
  assert.equal(overview.budget.limitCents, 455000);
  assert.equal(overview.budget.spentCents, 333500);
  assert.ok(overview.notifications.some((item) => item.id === 'moradia'));
  assert.ok(overview.transactions.every((item) => item.member));
});

test('transactions update shared browser data and validate category and amount', () => {
  const storage = createStorage();
  const month = new Date().toISOString().slice(0, 7);
  addDemoTransaction('jonas', {
    description: 'Lanche de teste',
    type: 'expense',
    amountCents: 560,
    categoryId: 'alimentacao',
    date: `${month}-11`,
    notes: ''
  }, storage);

  const overview = getDemoOverview('maria', month, storage);
  assert.equal(overview.categories[0].spentCents, 94060);
  assert.ok(overview.transactions.some((item) => item.description === 'Lanche de teste'));
  assert.throws(() => addDemoTransaction('jonas', {
    description: 'Compra', type: 'expense', amountCents: 0,
    categoryId: 'alimentacao', date: `${month}-11`
  }, storage), /valor válido/);
});

test('only the fictitious administrator can update a category budget', () => {
  const storage = createStorage();
  updateDemoCategoryBudget('maria', 'alimentacao', 130000, storage);
  assert.equal(
    getDemoOverview('maria', new Date().toISOString().slice(0, 7), storage)
      .categories[0].budgetCents,
    130000
  );
  assert.throws(
    () => updateDemoCategoryBudget('jonas', 'alimentacao', 140000, storage),
    /Somente administradores/
  );
});

test('reset restores the demo baseline and invalid local data fails explicitly', () => {
  const storage = createStorage();
  updateDemoCategoryBudget('maria', 'alimentacao', 130000, storage);
  resetDemoData(storage);
  assert.equal(
    getDemoOverview('maria', new Date().toISOString().slice(0, 7), storage)
      .categories[0].budgetCents,
    120000
  );

  storage.setItem(DEMO_STORAGE_KEY, '{invalid');
  assert.throws(() => getDemoOverview('maria', undefined, storage), /inválidos/);
});
