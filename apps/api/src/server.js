import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildOverview,
  createTransaction,
  InputError,
  updateCategoryBudget
} from './domain.js';
import { initializeStore, readStore, updateStore, verifyPassword } from './store.js';

const webRoot = resolve(
  fileURLToPath(new URL('../../web', import.meta.url))
);
const sessions = new Map();
const sessionLifetimeMs = 12 * 60 * 60 * 1000;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) {
      throw new InputError('A requisição excede o limite permitido.', 413);
    }
    chunks.push(chunk);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new InputError('O corpo da requisição deve ser um JSON válido.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new InputError('O corpo da requisição deve ser um objeto JSON.');
  }
  return payload;
}

function authenticatedUser(request) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  const session = sessions.get(token);

  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    throw new InputError('Sua sessão expirou. Entre novamente.', 401);
  }

  const user = readStore().users.find((item) => item.id === session.userId);
  if (!user) {
    sessions.delete(token);
    throw new InputError('Usuário não encontrado.', 401);
  }
  return { token, user };
}

async function serveStatic(pathname, response) {
  const requestedPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const filePath = resolve(webRoot, `.${requestedPath}`);

  if (!filePath.startsWith(`${webRoot}${sep}`)) {
    throw new InputError('Arquivo não encontrado.', 404);
  }

  let content;
  try {
    content = await readFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      throw new InputError('Arquivo não encontrado.', 404);
    }
    throw error;
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'"
  });
  response.end(content);
}

async function handleApi(request, response, url) {
  if (request.method === 'POST' && url.pathname === '/api/login') {
    const body = await readJson(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const user = readStore().users.find((item) => item.email.toLowerCase() === email);

    if (!user || !verifyPassword(user, password)) {
      throw new InputError('E-mail ou senha inválidos.', 401);
    }

    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expiresAt: Date.now() + sessionLifetimeMs });
    sendJson(response, 200, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
    return;
  }

  const { token, user } = authenticatedUser(request);

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    sessions.delete(token);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/overview') {
    const month = url.searchParams.get('month') ??
      new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new InputError('Informe um mês válido no formato AAAA-MM.');
    }

    const overview = buildOverview(readStore(), user, month);
    sendJson(response, 200, overview);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/transactions') {
    const body = await readJson(request);
    const family = readStore().families.find((item) => item.id === user.familyId);
    if (!family) {
      throw new InputError('Família não encontrada.', 404);
    }

    const transaction = createTransaction(body, user, family);
    await updateStore((state) => {
      state.transactions.push(transaction);
    });
    sendJson(response, 201, { transaction });
    return;
  }

  const categoryRoute = url.pathname.match(/^\/api\/categories\/([^/]+)\/budget$/);
  if (request.method === 'PATCH' && categoryRoute) {
    if (user.role !== 'ADMIN') {
      throw new InputError('Somente administradores podem alterar os limites.', 403);
    }

    const categoryId = decodeURIComponent(categoryRoute[1]);
    const body = await readJson(request);
    let updatedCategory;
    await updateStore((state) => {
      const family = state.families.find((item) => item.id === user.familyId);
      if (!family) {
        throw new InputError('Família não encontrada.', 404);
      }
      updateCategoryBudget(family, categoryId, body.budgetCents);
      updatedCategory = family.categories.find((item) => item.id === categoryId);
    });
    sendJson(response, 200, { category: updatedCategory });
    return;
  }

  throw new InputError('Rota não encontrada.', 404);
}

async function handleRequest(request, response) {
  const url = new URL(request.url, 'http://localhost');

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      throw new InputError('Método não permitido.', 405);
    }
    await serveStatic(url.pathname, response);
  } catch (error) {
    const statusCode = error instanceof InputError ? error.statusCode : 500;
    if (statusCode >= 500) {
      console.error(error);
    }
    if (!response.headersSent) {
      sendJson(response, statusCode, {
        error: statusCode === 500 ? 'Erro interno do servidor.' : error.message
      });
    } else {
      response.destroy(error);
    }
  }
}

await initializeStore();

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT deve ser uma porta válida entre 1 e 65535.');
}

createServer(handleRequest).listen(port, () => {
  console.log(`Contas em Dia disponível em http://localhost:${port}`);
});
