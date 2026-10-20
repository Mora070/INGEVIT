const {test} = require('node:test');
const assert = require('node:assert/strict');
const adapter = import('../src/features/proyectos/components/PlanViewer/autodesk.ts');
const pick = {intersection:{x:1,y:2,z:0},modelId:99};
test('Autodesk: las referencias de modelo no sobreviven a una sesión', async()=>{
 const {normalizarMediciones}=await adapter;
 const original=[{type:'Distance',picks:[pick,pick],options:{modelId:99}}];
 const normalized=normalizarMediciones(original);
 assert.equal(normalized[0].picks[0].modelId,undefined);
 assert.equal(normalized[0].options.modelId,undefined);
 assert.equal(original[0].picks[0].modelId,99);
});
test('Autodesk: excluye medidas incompletas y puntos no finitos', async()=>{
 const {medicionesCompletas}=await adapter;
 const measures=[{type:'Distance',picks:[pick,pick]},{type:'Angle',picks:[pick,pick]},{type:'Area',picks:[pick,pick,pick]},{type:'Distance',picks:[pick,{intersection:{x:NaN,y:0,z:0}}]}];
 assert.deepEqual(medicionesCompletas(measures).map(m=>m.type),['Distance','Area']);
});
test('Autodesk: el orden de claves JSONB no dispara un nuevo guardado', async()=>{
 const {serializarEstado}=await adapter;
 assert.equal(serializarEstado({schema:1,mediciones:[],calibracion:null,unidades:'m',precision:2}),serializarEstado({precision:2,unidades:'m',calibracion:null,mediciones:[],schema:1}));
});
