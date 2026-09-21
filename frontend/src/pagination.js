// Used for explicit exports and small, scoped auxiliary lists, never OS tables.
export async function fetchAllPages(request, endpoint, options = {}) {
  const url = new URL(endpoint, 'http://local');
  url.searchParams.set('limit', '500');
  const rows = [];
  let offset = 0;
  while (true) {
    url.searchParams.set('offset', String(offset));
    const payload = await request(`${url.pathname}${url.search}`, options);
    const batch = Array.isArray(payload.data) ? payload.data : [];
    rows.push(...batch);
    offset += batch.length;
    if (offset >= Number(payload.meta?.total ?? offset)) return { data: rows };
    if (!batch.length) throw new Error('A lista mudou durante o carregamento. Atualize e tente novamente.');
  }
}
