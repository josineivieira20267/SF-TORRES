const { clientLabel, clientKey } = require('./clientLabel');
// Keep only employee aggregates and the requested detail page in memory.
function createProductivityReport({ employees, absences, rules, query, helpers }) {
  const { normalize, specialBonusForEntry, rulesForAssignment, bonusDiscountFor } = helpers;
  const employeeByName = Object.fromEntries(employees.map((item) => [normalize(item.name), item]));
  const summaries = new Map();
  const options = { clients: new Set(), services: new Set(), employees: new Set() };
  const details = [];
  const limit = 50;
  const offset = Math.max(0, Math.floor(Number(query.offset) || 0));
  const detailOffset = Math.max(0, Math.floor(Number(query.detailOffset) || 0));
  let entryCount = 0;
  let orderCount = 0;
  const matches = (key, value) => !query[key] || query[key] === 'Todos' || (key === 'client' ? clientKey(query[key]) === clientKey(value) : query[key] === value);
  return {
    add(order) {
      if (order.client) options.clients.add(order.client);
      if (order.service) options.services.add(order.service);
      const members = Array.isArray(order.teamMembers) ? order.teamMembers : [];
      if (!matches('client', order.client) || !matches('service', order.service)) return;
      const countedEmployees = new Set();
      const paidSpecial = new Set();
      let matchedOrder = false;
      for (const name of members) {
        options.employees.add(name);
        const key = normalize(name);
        const employee = employeeByName[key] || { name, role: '-', team: '-' };
        const special = specialBonusForEntry(order, name, employeeByName, rules);
        const assigned = rulesForAssignment(order.teamRoles?.[name], rules);
        const criteria = special ? [{ name: special.name, base: 0, mode: 'per-os' }]
          : assigned.length ? assigned : [{ name: 'Sem critério', base: 0, mode: 'per-os' }];
        for (const criterion of criteria) {
          // Preserve the screen's existing rule: OS membership is a presence;
          // absence discounts come from the separate daily attendance register.
          const status = 'Presente';
          const text = normalize(`${order.number} ${order.client} ${order.service} ${order.date} ${name} ${criterion.name}`);
          if (!matches('employee', name) || !matches('status', status)
            || (query.q && !text.includes(normalize(query.q)))
            || (query.criterion && query.criterion !== 'Todos' && !normalize(criterion.name).includes(normalize(query.criterion)))) continue;
          matchedOrder = true;
          if (!summaries.has(key)) summaries.set(key, { name: employee.name, role: employee.role || '-', team: employee.team || '-', criteria: new Set(), os: 0, present: 0, absences: absences[key] || 0, standardBonus: 0, customBonus: 0 });
          const summary = summaries.get(key);
          summary.criteria.add(criterion.name);
          summary.present += 1;
          if (!countedEmployees.has(key)) { summary.os += 1; countedEmployees.add(key); }
          if (special && !paidSpecial.has(name)) { summary.customBonus += special.share; paidSpecial.add(name); }
          if (!special && criterion.mode !== 'monthly') summary.standardBonus += Number(criterion.base || 0);
          if (query.details === 'true' && entryCount >= detailOffset && details.length < limit) {
            details.push({ number: order.number, date: order.date, client: order.client, name, team: employee.team || '-', criterion: criterion.name, status,
              payable: criterion.mode === 'monthly' ? 0 : (special?.share ?? Number(criterion.base || 0) * bonusDiscountFor(summary.absences)) });
          }
          entryCount += 1;
        }
      }
      if (matchedOrder) orderCount += 1;
    },
    finish() {
      let totalBonus = 0;
      let totalAbsences = 0;
      const rows = [...summaries.values()].map((item) => {
        const factor = bonusDiscountFor(item.absences);
        const adjustedValue = item.standardBonus * factor;
        const monthly = item.criteria.has('Equipe PA') && item.present > 0 ? Number(rules.standard.find((rule) => rule.name === 'Equipe PA')?.base || 0) * factor : 0;
        const total = item.customBonus + adjustedValue + monthly;
        totalBonus += total;
        totalAbsences += item.absences;
        return { name: item.name, role: item.role, team: item.team, criterion: [...item.criteria].join(' + '), os: item.os, present: item.present, absences: item.absences, adjustedValue, factor, total };
      }).sort((a, b) => a.name.localeCompare(b.name));
      return {
        rows: rows.slice(offset, offset + limit), details,
        totals: { employees: rows.length, orders: orderCount, entries: entryCount, absences: totalAbsences, pending: 0, bonus: totalBonus },
        options: Object.fromEntries(Object.entries(options).map(([key, values]) => [key,
          (key === 'clients' ? [...new Map([...values].map((value) => [clientKey(value), clientLabel(value)])).values()] : [...values]).sort((a, b) => a.localeCompare(b))])),
        meta: { limit, offset, detailOffset }
      };
    }
  };
}

module.exports = { createProductivityReport };
