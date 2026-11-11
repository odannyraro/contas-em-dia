import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataFile = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../data/state.json'
);

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    passwordHash: scryptSync(password, salt, 64).toString('hex')
  };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function dateInCurrentMonth(day) {
  return `${currentMonth()}-${String(day).padStart(2, '0')}`;
}

function seedState() {
  const demoPassword = process.env.DEMO_PASSWORD || 'familia123';
  const passwordFields = () => hashPassword(demoPassword);

  return {
    users: [
      {
        id: 'maria',
        name: 'Maria Fernandes',
        email: 'maria@contas.local',
        role: 'ADMIN',
        familyId: 'familia-fernandes',
        ...passwordFields()
      },
      {
        id: 'jonas',
        name: 'Jonas Fernandes',
        email: 'jonas@contas.local',
        role: 'PARTICIPANT',
        familyId: 'familia-fernandes',
        ...passwordFields()
      },
      {
        id: 'rafael',
        name: 'Rafael Fernandes',
        email: 'rafael@contas.local',
        role: 'PARTICIPANT',
        familyId: 'familia-fernandes',
        ...passwordFields()
      }
    ],
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

let state;
let updateQueue = Promise.resolve();

export async function initializeStore() {
  try {
    state = JSON.parse(await readFile(dataFile, 'utf8'));
    await chmod(dataFile, 0o600);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    state = seedState();
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  }
}

export function readStore() {
  if (!state) {
    throw new Error('O armazenamento ainda não foi inicializado.');
  }
  return state;
}

export function updateStore(mutator) {
  const operation = updateQueue.then(async () => {
    const next = structuredClone(readStore());
    const result = mutator(next);
    const temporaryFile = `${dataFile}.${process.pid}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryFile, dataFile);
    state = next;
    return result;
  });

  updateQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function verifyPassword(user, password) {
  const candidate = scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.passwordHash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
