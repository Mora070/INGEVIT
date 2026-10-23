const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const build=process.env.ARCHIVOS_TEST_BUILD || path.join(__dirname,'../dist');
const {validarArchivoCarpeta,MAX_ARCHIVO_CARPETA}=require(path.join(build,'modules/carpetas/validar-archivo-carpeta'));
const {CarpetasArchivosService}=require(path.join(build,'modules/carpetas/carpetas-archivos.service'));
const {ResultadoTransaccionDesconocidoError}=require(path.join(build,'database/errors/resultado-transaccion-desconocido.error'));
const archivo=(name,buffer)=>({originalname:name,buffer});
function zipNombres(nombres){const partes=nombres.map(nombre=>{const b=Buffer.alloc(46+Buffer.byteLength(nombre));b.writeUInt32LE(0x02014b50);b.writeUInt16LE(Buffer.byteLength(nombre),28);b.write(nombre,46);return b;});const central=Buffer.concat(partes);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(nombres.length,10);end.writeUInt32LE(central.length,12);return Buffer.concat([central,end]);}
test('acepta PDF y DWG, sin depender del MIME del navegador',()=>{
assert.equal(validarArchivoCarpeta(archivo('Obra.DWG',Buffer.from('AC1032datos'))).extension,'dwg');
assert.equal(validarArchivoCarpeta(archivo('doc.pdf',Buffer.from('%PDF-1.7\ncontenido'))).mime_type,'application/pdf');
});
test('distingue estructura XLSX de un ZIP genérico',()=>{
assert.equal(validarArchivoCarpeta(archivo('libro.xlsx',zipNombres(['[Content_Types].xml','xl/workbook.xml']))).extension,'xlsx');
assert.throws(()=>validarArchivoCarpeta(archivo('libro.xlsx',zipNombres(['documento.txt']))));
});
test('XLS requiere cabecera OLE y nombre de flujo de libro',()=>{
const ole=Buffer.from('d0cf11e0a1b11ae1','hex');assert.throws(()=>validarArchivoCarpeta(archivo('libro.xls',ole)));
assert.equal(validarArchivoCarpeta(archivo('libro.xls',Buffer.concat([ole,Buffer.from('Workbook','utf16le')]))).extension,'xls');
});
test('rechaza vacíos, extensiones falsas y archivos demasiado grandes',()=>{
for(const f of [archivo('a.pdf',Buffer.alloc(0)),archivo('a.exe',Buffer.from('%PDF-')),archivo('a.dwg',Buffer.from('hola')),archivo('a.pdf',Buffer.alloc(MAX_ARCHIVO_CARPETA+1))])assert.throws(()=>validarArchivoCarpeta(f));
});
function servicio({acceso=true,carpeta=true,fallo=null}={}){
const guardados=[],eliminados=[];let consultas=0;
const client={query:async(sql,args)=>{consultas++;if(fallo)throw fallo;return {rows:[{id_archivo:'id',nombre:args?.[3]}]};}};
const s=new CarpetasArchivosService({withTransaction:fn=>fn(client)}, {bloquearDisponible:async()=>acceso},{bloquear:async()=>carpeta?{}:null}, {guardar:async(k)=>guardados.push(k),eliminar:async(k)=>eliminados.push(k),abrirLectura:async()=>{throw Error('No debe abrir');}});
return {s,guardados,eliminados,get consultas(){return consultas;}};
}
test('deniega carga fuera del proyecto antes de guardar bytes',async()=>{const f=servicio({acceso:false});await assert.rejects(f.s.subir('p','c','u',archivo('a.pdf',Buffer.from('%PDF-'))));assert.equal(f.guardados.length,0);assert.equal(f.consultas,0);});
test('deniega carpetas que no pertenecen al proyecto',async()=>{const f=servicio({carpeta:false});await assert.rejects(f.s.subir('p','c','u',archivo('a.pdf',Buffer.from('%PDF-'))));assert.equal(f.guardados.length,0);});
test('registra un archivo con clave interna aleatoria',async()=>{const f=servicio();await f.s.subir('p','c','u',archivo('a.pdf',Buffer.from('%PDF-')));assert.match(f.guardados[0],/^archivos\/[a-f0-9-]+\.pdf$/);assert.equal(f.eliminados.length,0);});
test('compensa el almacenamiento cuando falla el registro',async()=>{const f=servicio({fallo:Error('SQL')});await assert.rejects(f.s.subir('p','c','u',archivo('a.pdf',Buffer.from('%PDF-'))));assert.deepEqual(f.eliminados,f.guardados);});
test('conserva bytes ante un COMMIT incierto',async()=>{const f=servicio({fallo:new ResultadoTransaccionDesconocidoError('COMMIT',Error('red'))});await assert.rejects(f.s.subir('p','c','u',archivo('a.pdf',Buffer.from('%PDF-'))));assert.equal(f.eliminados.length,0);});
