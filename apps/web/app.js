import {
  addDemoTransaction,
  DEMO_STORAGE_KEY,
  getDemoOverview,
  initializeDemoData,
  resetDemoData,
  signInDemoUser,
  updateDemoCategoryBudget
} from './demo-store.js';

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const loginForm = document.querySelector('#login-form');
const transactionForm = document.querySelector('#transaction-form');
const loginError = document.querySelector('#login-error');
const transactionError = document.querySelector('#transaction-error');
const userKey = 'contas-em-dia-demo-user-v1';
let userId = sessionStorage.getItem(userKey);
let overview;
let toastTimeout;

function money(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100);
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).format(new Date(`${value}T12:00:00`));
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3000);
}

function showLogin(message = '') {
  loginView.hidden = false;
  appView.hidden = true;
  loginError.textContent = message;
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}

function setBudgetHeader(data) {
  const monthDate = new Date(`${data.month}-01T12:00:00`);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric'
  }).format(monthDate);
  document.querySelector('#family-name').textContent = data.family.name;
  document.querySelector('#member-name').textContent = data.user.name;
  document.querySelector('#member-role').textContent =
    data.user.role === 'ADMIN' ? 'ADMINISTRADOR' : 'PARTICIPANTE';
  document.querySelector('#greeting-name').textContent = data.user.name.split(' ')[0];
  document.querySelector('#month-label').textContent =
    `${label.charAt(0).toUpperCase()}${label.slice(1)} · orçamento de demonstração`;
  document.querySelector('#budget-total').textContent = money(data.budget.limitCents);
  document.querySelector('#spent-total').textContent = money(data.budget.spentCents);
  document.querySelector('#spent-percent').textContent = `${data.budget.percent}% do orçamento`;
  document.querySelector('#remaining-total').textContent = money(data.budget.remainingCents);
  document.querySelector('#income-total').textContent = money(data.incomeCents);
}

function renderNotifications(items) {
  const container = document.querySelector('#notifications');
  container.replaceChildren();
  container.hidden = items.length === 0;

  for (const notification of items) {
    const item = element('div', `notification ${notification.level}`);
    item.append(
      element('span', 'notification-mark', notification.level === 'over' ? '!' : '◷'),
      element('span', '', notification.message)
    );
    container.append(item);
  }
}

function renderCategories(categories, isAdmin) {
  const container = document.querySelector('#category-list');
  const select = document.querySelector('#transaction-category');
  container.replaceChildren();
  select.replaceChildren();

  for (const category of categories) {
    const row = element('article', 'category-row');
    const top = element('div', 'category-top');
    top.append(
      element('span', 'category-name', category.name),
      element('span', 'category-values')
    );
    top.lastChild.append(
      element('strong', '', money(category.spentCents)),
      document.createTextNode(` / ${money(category.budgetCents)}`)
    );

    const track = element('div', 'progress-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', `Orçamento de ${category.name}`);
    track.setAttribute('aria-valuenow', String(category.percent));
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    const fill = element('div', `progress-fill${category.percent >= 100 ? ' over' : category.percent >= 80 ? ' warning' : ''}`);
    fill.style.width = `${Math.min(category.percent, 100)}%`;
    track.append(fill);
    row.append(top, track);

    const meta = element('div', 'category-meta');
    meta.append(
      element('span', '', `${category.percent}% utilizado`),
      element('span', '', `${money(Math.max(category.budgetCents - category.spentCents, 0))} disponível`)
    );
    row.append(meta);

    if (isAdmin) {
      const form = element('form', 'category-edit');
      const label = element('label', '', 'Limite');
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '0.01';
      input.value = (category.budgetCents / 100).toFixed(2);
      input.setAttribute('aria-label', `Novo limite para ${category.name}`);
      const button = element('button', '', 'Atualizar');
      button.type = 'submit';
      label.append(input);
      form.append(label, button);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const budgetCents = Math.round(Number(input.value) * 100);
        button.disabled = true;
        try {
          updateDemoCategoryBudget(userId, category.id, budgetCents);
          refresh();
          showToast('Limite atualizado nos dados deste navegador.');
        } catch (error) {
          showToast(error.message);
        } finally {
          button.disabled = false;
        }
      });
      row.append(form);
    }

    container.append(row);
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    select.append(option);
  }
}

function renderTransactions(transactions) {
  const container = document.querySelector('#transaction-list');
  container.replaceChildren();
  if (transactions.length === 0) {
    container.append(element('p', 'empty-state', 'Ainda não há lançamentos neste mês.'));
    return;
  }

  for (const transaction of transactions.slice(0, 7)) {
    const item = element('article', 'transaction-item');
    const isIncome = transaction.type === 'income';
    item.append(element('span', `transaction-icon${isIncome ? ' income' : ''}`, isIncome ? '↗' : '↘'));
    const main = element('div', 'transaction-main');
    main.append(
      element('p', 'transaction-title', transaction.description),
      element('p', 'transaction-subtitle', `${transaction.categoryName} · ${transaction.member} · ${dateLabel(transaction.date)}`)
    );
    item.append(main, element('span', `transaction-amount${isIncome ? ' income' : ''}`, `${isIncome ? '+' : '−'} ${money(transaction.amountCents)}`));
    container.append(item);
  }
}

function renderGoals(goals) {
  const container = document.querySelector('#goal-list');
  container.replaceChildren();
  if (goals.length === 0) {
    container.append(element('p', 'empty-state', 'A família ainda não criou uma meta.'));
    return;
  }

  for (const goal of goals) {
    const percent = goal.targetCents === 0
      ? 0
      : Math.min(Math.round((goal.currentCents / goal.targetCents) * 100), 100);
    const card = element('article', 'goal-card');
    const top = element('div', 'goal-top');
    top.append(element('p', 'goal-name', goal.name), element('span', 'goal-percent', `${percent}%`));
    const track = element('div', 'progress-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', `Progresso da meta ${goal.name}`);
    track.setAttribute('aria-valuenow', String(percent));
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    const fill = element('div', 'progress-fill');
    fill.style.width = `${percent}%`;
    track.append(fill);
    const values = element('div', 'goal-values');
    values.append(element('span', '', money(goal.currentCents)), element('span', '', `Meta ${money(goal.targetCents)}`));
    card.append(top, track, values);
    container.append(card);
  }
}

function render(data) {
  overview = data;
  setBudgetHeader(data);
  renderNotifications(data.notifications);
  renderCategories(data.categories, data.user.role === 'ADMIN');
  renderTransactions(data.transactions);
  renderGoals(data.goals);
  document.querySelector('#category-field').hidden =
    document.querySelector('#transaction-type').value === 'income';
}

function refresh() {
  render(getDemoOverview(userId));
  showApp();
}

function signOut(message = '') {
  userId = null;
  overview = null;
  sessionStorage.removeItem(userKey);
  showLogin(message);
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const formData = new FormData(loginForm);
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const user = signInDemoUser(formData.get('email'), formData.get('password'));
    userId = user.id;
    sessionStorage.setItem(userKey, userId);
    refresh();
  } catch (error) {
    showLogin(error.message);
  } finally {
    button.disabled = false;
  }
});

transactionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  transactionError.textContent = '';
  const formData = new FormData(transactionForm);
  const type = formData.get('type');
  const button = transactionForm.querySelector('button[type="submit"]');
  const transaction = {
    description: formData.get('description'),
    type,
    amountCents: Math.round(Number(formData.get('amount')) * 100),
    date: formData.get('date'),
    notes: formData.get('notes')
  };
  if (type === 'expense') transaction.categoryId = formData.get('categoryId');

  button.disabled = true;
  try {
    addDemoTransaction(userId, transaction);
    transactionForm.reset();
    document.querySelector('#transaction-date').value = todayLocal();
    document.querySelector('#transaction-type').dispatchEvent(new Event('change'));
    document.querySelector('#transaction-category').value =
      overview?.categories[0]?.id ?? '';
    refresh();
    showToast('Lançamento registrado nos dados deste navegador.');
  } catch (error) {
    transactionError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#transaction-type').addEventListener('change', (event) => {
  const isExpense = event.target.value === 'expense';
  document.querySelector('#category-field').hidden = !isExpense;
  document.querySelector('#transaction-category').required = isExpense;
});

document.querySelector('#transaction-date').value = todayLocal();
document.querySelector('#logout-button').addEventListener('click', () => signOut('Você saiu da demonstração.'));
document.querySelector('#reset-demo-button').addEventListener('click', () => {
  if (!window.confirm('Restaurar os dados de demonstração neste navegador? Os lançamentos e limites alterados serão apagados.')) {
    return;
  }
  try {
    resetDemoData();
    refresh();
    showToast('Dados de demonstração restaurados.');
  } catch (error) {
    showToast(error.message);
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === DEMO_STORAGE_KEY && userId && !appView.hidden) {
    try {
      refresh();
    } catch (error) {
      showToast(error.message);
    }
  }
});

try {
  initializeDemoData();
  if (userId) {
    refresh();
  } else {
    showLogin();
  }
} catch (error) {
  userId = null;
  sessionStorage.removeItem(userKey);
  showLogin(error.message);
}
