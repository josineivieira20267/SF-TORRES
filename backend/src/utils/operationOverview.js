const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const isFinal = (status) => normalize(status).includes('finaliz') || normalize(status).includes('conclu');
const isQueue = (status) => ['programado', 'rascunho', 'enviada', 'aprovada'].includes(normalize(status));
function createOverview(query) {
  const statusCounts = { abertos: 0, finalizados: 0, todos: 0 };
  const totals = { active: 0, done: 0, queue: 0, alerts: 0, programmed: 0, total: 0 };
  const members = new Map();
  return {
    add(item) {
      const status = normalize(item.status);
      const final = isFinal(status);
      const open = !final && !status.includes('cancel');
      statusCounts.todos++;
      if (final) statusCounts.finalizados++;
      if (open) statusCounts.abertos++;
      const matches = query.statusGroup === 'Finalizados' ? final : query.statusGroup === 'Abertos' ? open : true;
      // Tower indicators describe the whole month, including orders outside its queue.
      if (query.overview !== 'tower' && !matches) return;
      totals.total++;
      if (status.includes('exec')) totals.active++;
      if (final) totals.done++;
      if (isQueue(status)) totals.queue++;
      if (status === 'programado') totals.programmed++;
      if (['paralisada', 'cancelada', 'cancelado'].includes(status)) totals.alerts++;
      if (query.overview !== 'schedules') return;
      for (const name of new Set(Array.isArray(item.teamMembers) ? item.teamMembers.filter(Boolean) : [])) {
        if (!members.has(name)) members.set(name, { name, today: 0, total: 0, programmed: 0, active: 0, done: 0, clients: new Set() });
        const member = members.get(name);
        member.total++;
        if (String(item.date || '').slice(0, 10) === query.today) member.today++;
        if (status === 'programado') member.programmed++;
        if (status.includes('exec')) member.active++;
        if (final) member.done++;
        if (item.client) member.clients.add(item.client);
      }
    },
    finish() {
      return { statusCounts, totals, members: [...members.values()].map((item) => ({ ...item, clients: item.clients.size })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)) };
    }
  };
}
module.exports = { createOverview };
