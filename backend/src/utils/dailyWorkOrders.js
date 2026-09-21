const fields = ['number', 'client', 'equipment', 'service', 'carrier'];
const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const clients = (query) => JSON.parse(query.clients || '[]');

function dailyFilters(where, query) {
  const AND = [...(where.AND || [])];
  const selected = clients(query);
  if (selected.length) AND.push({ OR: selected.map((client) => ({ client: { equals: client, mode: 'insensitive' } })) });
  if (query.dailyStatus) AND.push({ status: { equals: query.dailyStatus, mode: 'insensitive' } });
  for (const value of [query.search, query.tableSearch]) {
    if (String(value || '').trim()) AND.push({ OR: fields.map((field) => ({ [field]: { contains: String(value).trim(), mode: 'insensitive' } })) });
  }
  return { ...where, AND };
}

function dailyJsonFilters(items, query) {
  const selected = clients(query).map(normalize);
  return items.filter((item) => (!selected.length || selected.includes(normalize(item.client)))
    && (!query.dailyStatus || normalize(item.status) === normalize(query.dailyStatus))
    && [query.search, query.tableSearch].every((value) => !normalize(value) || fields.some((field) => normalize(item[field]).includes(normalize(value)))));
}

module.exports = { dailyFilters, dailyJsonFilters };
