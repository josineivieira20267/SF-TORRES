const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { createController } = require('../utils/crud');

const router = express.Router();

const resources = {
  clients: createController('clients', ['name', 'legalName', 'cnpj', 'contact', 'city', 'status'], 'client'),
  employees: createController('employees', ['name', 'cpf', 'role', 'team', 'status'], 'employee'),
  services: createController('services', ['code', 'description', 'unit', 'category'], 'service'),
  equipment: createController('equipment', ['code', 'type', 'model', 'status'], 'equipment'),
  locations: createController('locations', ['code', 'description', 'client', 'address', 'status'], 'location'),
  workOrders: createController('workOrders', ['number', 'client', 'equipment', 'service', 'status', 'carrier'], 'workOrder'),
  measurements: createController('measurements', ['number', 'client', 'workOrder', 'status'], 'measurement')
};

router.use(requireAuth);

for (const [route, controller] of Object.entries(resources)) {
  router.get(`/${route}`, controller.list);
  router.post(`/${route}`, controller.create);
  router.get(`/${route}/:id`, controller.get);
  router.put(`/${route}/:id`, controller.update);
  router.delete(`/${route}/:id`, controller.remove);
}

module.exports = router;
