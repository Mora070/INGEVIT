require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PlanosMedicionesService } = require('../dist/modules/planos/planos-mediciones.service');
const { validarEstadoMediciones } = require('../dist/modules/planos/mediciones-estado');
const estado = () => ({schema: 1, mediciones: [], calibracion: null, unidades: 'm', precision: 2});
function preparar({acceso = true, paginas = 2, version = 0, falloAviso = false} = {}) {
  const consultas = [];
  const client = { async query(sql, values) {
    consultas.push({sql, values});
    if (sql.includes('SELECT numero_paginas')) return {rows: paginas ? [{numero_paginas: paginas}] : []};
    if (sql.includes('SELECT version')) return {rows: version ? [{version, estado: estado()}] : []};
    if (sql.includes('INSERT INTO')) return {rows: [{version: values[2], estado: JSON.parse(values[3])}]};
    if (falloAviso) throw new Error('notify failed');
    return {rows: []};
  }};
  const service = new PlanosMedicionesService({withTransaction: f => f(client)}, {bloquearDisponible: async () => acceso});
  return {service, consultas};
}
test('mediciones: no consulta planos ajenos', async () => {
  const {service, consultas} = preparar({acceso: false});
  await assert.rejects(service.consultar('p', 'pl', 1, 'u'), e => e.getStatus() === 404);
  assert.equal(consultas.length, 0);
});
test('mediciones: rechaza páginas fuera del PDF', async () => {
  const {service} = preparar();
  for (const pagina of [0, -1, 3, 1.5]) await assert.rejects(service.consultar('p', 'pl', pagina, 'u'), e => e.getStatus() === 400);
});
test('mediciones: estado inicial sin escritura', async () => {
  const {service, consultas} = preparar();
  assert.deepEqual(await service.consultar('p', 'pl', 1, 'u'), {version: 0, estado: estado()});
  assert.equal(consultas.some(q => q.sql.includes('INSERT')), false);
});
test('mediciones: conflicto no sobrescribe ni publica eventos', async () => {
  const {service, consultas} = preparar({version: 2});
  await assert.rejects(service.guardar('p','pl',1,'u',{version: 1,estado: estado()}), e => e.getStatus() === 409);
  assert.equal(consultas.some(q => /INSERT|pg_notify/.test(q.sql)), false);
});
test('mediciones: guarda versión y publica dentro de la transacción', async () => {
  const {service, consultas} = preparar({version: 2});
  const result = await service.guardar('p','pl',2,'u',{version: 2,estado: estado()});
  assert.equal(result.version, 3);
  assert.deepEqual(consultas[2].values.slice(0, 3), ['pl', 2, 3]);
  assert.match(consultas[3].sql, /pg_notify/);
  assert.match(consultas[0].sql, /FOR UPDATE/);
});
test('mediciones: propaga error transaccional de notificación', async () => {
  const {service} = preparar({falloAviso: true});
  await assert.rejects(service.guardar('p','pl',1,'u',{version: 0,estado: estado()}), /notify failed/);
});
test('mediciones: valida calibración, geometría y límites del documento', () => {
  assert.doesNotThrow(() => validarEstadoMediciones(estado()));
  for (const patch of [{schema: 2}, {precision: -1}, {unidades: 'invalida'}, {calibracion: {factor: 0, unidades: 'm'}}, {mediciones: Array(501).fill({})}, {mediciones: [{type:'Distance',picks:[]}]}, {extra: 'x'.repeat(512001)}]) {
    assert.throws(() => validarEstadoMediciones({...estado(), ...patch}), e => e.getStatus() === 400);
  }
  const pick = {intersection: {x: 1, y: 2, z: 0}};
  assert.doesNotThrow(() => validarEstadoMediciones({...estado(), mediciones: [{type:'Distance',picks:[pick,pick]}]}));
  assert.throws(() => validarEstadoMediciones({...estado(), mediciones: [{type:'Distance',picks:[pick,{intersection:{x:Infinity,y:0,z:0}}]}]}));
});
