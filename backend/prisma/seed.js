const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../src/generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@sftorres.local' },
    update: {},
    create: {
      id: 'usr_admin',
      name: 'Administrador SF',
      email: 'admin@sftorres.local',
      role: 'Administrador',
      status: 'Ativo',
      passwordHash: bcrypt.hashSync('admin123', 10)
    }
  });

  await prisma.client.createMany({
    data: [
      { id: 'cli_semp', name: 'SEMP TCL', legalName: 'SEMP TCL', cnpj: '12.345.678/0001-90', contact: 'Roberto K.', phone: '(11) 4002-8922', city: 'Sao Paulo', state: 'SP', contract: 'CT-2026/014', monthRevenue: 125430, status: 'Ativo' },
      { id: 'cli_adf', name: 'ADF Logistica', legalName: 'ADF Logistica', cnpj: '98.765.432/0001-12', contact: 'Patricia N.', phone: '(92) 3233-7700', city: 'Manaus', state: 'AM', contract: 'CT-2026/009', monthRevenue: 58820, status: 'Ativo' }
    ],
    skipDuplicates: true
  });

  await prisma.employee.createMany({
    data: [
      { id: 'emp_0001', code: '0001', name: 'Joana Almeida', cpf: '123.456.789-00', role: 'Lider de turno', team: 'Alianca', admissionDate: '2022-03-15', status: 'Ativo' },
      { id: 'emp_0002', code: '0002', name: 'Marcelo Souza', cpf: '234.567.890-11', role: 'Operador', team: 'Alianca', admissionDate: '2023-05-08', status: 'Ativo' },
      { id: 'emp_0003', code: '0003', name: 'Beatriz Lima', cpf: '345.678.901-22', role: 'Operadora', team: 'TransNorte', admissionDate: '2024-09-02', status: 'Ativo' },
      { id: 'emp_0004', code: '0004', name: 'Ronaldo Pena', cpf: '456.789.012-33', role: 'Operador', team: 'Mov. Sul', admissionDate: '2021-01-20', status: 'Ferias' }
    ],
    skipDuplicates: true
  });

  await prisma.service.createMany({
    data: [
      { id: 'srv_001', code: 'SV-001', description: 'Containerizacao', unit: 'unidade', price: 348, category: 'Operacional' },
      { id: 'srv_002', code: 'SV-002', description: 'Desova', unit: 'unidade', price: 348, category: 'Operacional' },
      { id: 'srv_003', code: 'SV-003', description: 'Carga e Descarga', unit: 'tonelada', price: 92, category: 'Operacional' },
      { id: 'srv_004', code: 'SV-004', description: 'Limpeza e Conservacao', unit: 'm2', price: 4.8, category: 'Conservacao' }
    ],
    skipDuplicates: true
  });

  await prisma.equipment.createMany({
    data: [
      { id: 'eq_hamu', code: 'HAMU2997067', type: "Container 40'", model: 'Hamburg Sud - Dry', capacity: '67 m3', lastMaintenance: '2026-06-12', status: 'Em uso' },
      { id: 'eq_msku', code: 'MSKU7738422', type: "Container 20'", model: 'Maersk - Reefer', capacity: '28 m3', status: 'Disponivel' },
      { id: 'eq_cav014', code: 'CAV-014', type: 'Caminhao', model: 'Mercedes Atego 1719', capacity: '9 ton', lastMaintenance: '2026-07-02', status: 'Manutencao' }
    ],
    skipDuplicates: true
  });

  await prisma.location.createMany({
    data: [
      { id: 'loc_pa03', code: 'PA-03', description: 'Patio 3', client: 'SEMP TCL', address: 'Av. Brigadeiro, 4500 - Manaus/AM', areaM2: 2800, status: 'Operacional' },
      { id: 'loc_pa02', code: 'PA-02', description: 'Patio 2', client: 'SEMP TCL', address: 'Av. Brigadeiro, 4480 - Manaus/AM', areaM2: 1900, status: 'Operacional' },
      { id: 'loc_pocsf', code: 'PO-CSF', description: 'Porto CSF - Terminal 2', client: 'ADF Logistica', address: 'R. do Porto, s/n - Manaus/AM', areaM2: 12000, status: 'Operacional' }
    ],
    skipDuplicates: true
  });

  await prisma.workOrder.createMany({
    data: [
      { id: 'wo_159', number: '0007-159', client: 'SEMP TCL', equipment: 'HAMU2997067', status: 'Aprovada', date: '2026-07-23', carrier: 'Alianca', service: 'Desova', location: 'PA-03', responsible: 'Administrador SF', progress: 100, priority: 'Normal' },
      { id: 'wo_160', number: '0007-160', client: 'SEMP TCL', equipment: '', status: 'Aprovada', date: '2026-07-22', carrier: 'Alianca', service: 'Containerizacao', location: 'PA-03', responsible: 'Administrador SF', progress: 100, priority: 'Normal' },
      { id: 'wo_158d', number: '0007-158d', client: 'SEMP TCL', equipment: '', status: 'Enviada', date: '2026-07-22', carrier: 'Alianca', service: 'Desova', location: 'PA-02', responsible: 'Administrador SF', progress: 40, priority: 'Normal' },
      { id: 'wo_157', number: '0007-157', client: 'ADF Logistica', equipment: 'CAV-014', status: 'Em execucao', date: '2026-07-21', carrier: 'TransNorte', service: 'Carga e Descarga', location: 'PO-CSF', responsible: 'Joana Almeida', progress: 72, priority: 'Alta' }
    ],
    skipDuplicates: true
  });

  await prisma.measurement.createMany({
    data: [
      { id: 'mea_044', number: '#044', client: 'SEMP TCL', workOrder: '0007-159', period: '2026-07-23/2026-07-24', quantity: 42, unitPrice: 348, total: 14616, status: 'Fechada' },
      { id: 'mea_043', number: '#043', client: 'SEMP TCL', workOrder: '0007-160', period: '2026-07-22/2026-07-23', quantity: 53, unitPrice: 348, total: 18444, status: 'Fechada' },
      { id: 'mea_042', number: '#042', client: 'SEMP TCL', workOrder: '0007-158', period: '2026-07-20/2026-07-21', quantity: 38, unitPrice: 348, total: 13224, status: 'Pendente' },
      { id: 'mea_041', number: '#041', client: 'ADF Logistica', workOrder: '0007-157', period: '2026-07-21', quantity: 120, unitPrice: 92, total: 11040, status: 'Fechada' }
    ],
    skipDuplicates: true
  });

  await prisma.occurrence.createMany({
    data: [
      { id: 'occ_001', workOrder: '0007-159', type: 'Operacional', description: 'Ajuste de horario solicitado pelo cliente', status: 'Em analise' },
      { id: 'occ_002', workOrder: '0007-157', type: 'Seguranca', description: 'Registro preventivo em area de carga', status: 'Em analise' }
    ],
    skipDuplicates: true
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
