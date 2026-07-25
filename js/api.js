const SF_API_URL = 'http://127.0.0.1:3333';

const SFSession = {
  get token() {
    return localStorage.getItem('sfTorresToken');
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem('sfTorresUser') || 'null');
    } catch (_) {
      return null;
    }
  },
  clear() {
    localStorage.removeItem('sfTorresToken');
    localStorage.removeItem('sfTorresUser');
  }
};

async function sfApi(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (SFSession.token) {
    headers.Authorization = `Bearer ${SFSession.token}`;
  }

  const response = await fetch(`${SF_API_URL}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (response.status === 401) {
    SFSession.clear();
    location.href = 'login.html';
    throw new Error('Sessao expirada');
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Falha na comunicacao com a API');
  }

  return payload;
}
