const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { readDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');

const router = express.Router();

router.use(requireAuth);

router.get('/summary', async (req, res, next) => {
  try {
    if (hasDatabaseUrl) {
      const [workOrders, clients, employees, occurrences, measurements] = await Promise.all([
        prisma.workOrder.findMany(),
        prisma.client.count({ where: { status: 'Ativo' } }),
        prisma.employee.count({ where: { status: 'Ativo' } }),
        prisma.occurrence.count({ where: { NOT: { status: 'Resolvida' } } }),
        prisma.measurement.findMany({ where: { status: 'Fechada' } })
      ]);
      const byStatus = workOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});
      return res.json({
        data: {
          workOrders: { total: workOrders.length, byStatus },
          activeClients: clients,
          activeEmployees: employees,
          openOccurrences: occurrences,
          billedMonth: measurements.reduce((sum, item) => sum + Number(item.total || 0), 0)
        }
      });
    }

    const db = await readDb();
    const byStatus = db.workOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
    const billedMonth = db.measurements
      .filter((item) => item.status === 'Fechada')
      .reduce((sum, item) => sum + Number(item.total || 0), 0);

    res.json({
      data: {
        workOrders: {
          total: db.workOrders.length,
          byStatus
        },
        activeClients: db.clients.filter((item) => item.status === 'Ativo').length,
        activeEmployees: db.employees.filter((item) => item.status === 'Ativo').length,
        openOccurrences: db.occurrences.filter((item) => item.status !== 'Resolvida').length,
        billedMonth
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
