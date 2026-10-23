import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import type { CSSProperties } from 'react';
export interface ExcelCell { text: string; style?: CSSProperties; rowSpan?: number; colSpan?: number; covered?: boolean; }
export interface ExcelImage { blob: Blob; x: number; y: number; width: number; height: number; }
export interface ExcelSheet { name: string; widths: number[]; heights: number[]; cells: ExcelCell[][]; images: ExcelImage[]; limited: boolean; }
export interface ExcelBook { sheets: ExcelSheet[]; warnings: string[]; }
const palette=['FFFFFF','000000','EEECE1','1F497D','4F81BD','C0504D','9BBB59','8064A2','4BACC6','F79646'];
function color(c?: Partial<ExcelJS.Color>): string | undefined {
 const hex=c?.argb?.slice(-6) ?? (c?.theme !== undefined ? palette[c.theme] : undefined);
 return hex && /^[0-9a-f]{6}$/i.test(hex) ? '#'+hex : undefined;
}
function styleOf(cell: ExcelJS.Cell): CSSProperties {
 const {font,fill,alignment,border}=cell;
 const style: CSSProperties={};
 if(font){style.fontFamily=font.name;style.fontSize=font.size ? font.size*4/3 : undefined;style.fontWeight=font.bold?700:400;style.fontStyle=font.italic?'italic':'normal';style.color=color(font.color);style.textDecoration=font.strike?'line-through':font.underline?'underline':undefined;}
 if(fill?.type==='pattern' && fill.pattern==='solid')style.backgroundColor=color(fill.fgColor);
 if(alignment){style.textAlign=['left','center','right','justify'].includes(alignment.horizontal ?? '') ? alignment.horizontal as CSSProperties['textAlign']:undefined;style.verticalAlign=alignment.vertical==='middle'?'middle':alignment.vertical;style.whiteSpace=alignment.wrapText?'pre-wrap':'pre';}
 for(const [side,css] of [['top','borderTop'],['bottom','borderBottom'],['left','borderLeft'],['right','borderRight']] as const){
 const b=border?.[side];if(b?.style)style[css]=(b.style==='thick'?3:b.style==='medium'?2:1)+'px '+(b.style==='double'?'double':b.style.includes('dash')||b.style.includes('Dash')?'dashed':b.style==='dotted'?'dotted':'solid')+' '+(color(b.color)??'#333333');
 }
 return style;
}
function coordinate(value: number, sizes: number[]): number { const full=Math.floor(value);return sizes.slice(0,full).reduce((a,b)=>a+b,0)+(sizes[full]??0)*(value-full); }
export async function readExcel(data: ArrayBuffer, extension: string): Promise<ExcelBook> {
 const raw=XLSX.read(data,{type:'array',cellStyles:true,cellNF:true,sheetRows:1001,cellHTML:false});
 let styled: ExcelJS.Workbook | undefined;
 const warnings=new Set<string>();
 if(extension==='xlsx'){
   try { styled=new ExcelJS.Workbook();await styled.xlsx.load(data); }
   catch { styled=undefined;warnings.add('No se pudieron recuperar todos los estilos e imágenes.'); }
 } else warnings.add('La vista de archivos XLS conserva datos y combinaciones; algunos estilos e imágenes pueden no mostrarse.');
 const sheets: ExcelSheet[]=[];let budget=100000;
 for(const name of raw.SheetNames.slice(0,50)){
   const index=raw.SheetNames.indexOf(name);
   if(raw.Workbook?.Sheets?.[index]?.Hidden)continue;
   const source=raw.Sheets[name];const range=XLSX.utils.decode_range(source['!fullref']??source['!ref']??'A1');
   const cols=Math.min(100,Math.max(1,range.e.c+1));const rows=Math.min(1000,Math.max(1,range.e.r+1),Math.floor(Math.min(30000,budget)/cols));
   if(rows<1){warnings.add('Se alcanzó el límite de vista previa. Descarga el archivo para consultar todas las hojas.');break;}budget-=rows*cols;
   const sheet:ExcelSheet={name,widths:[],heights:[],cells:[],images:[],limited:rows<=range.e.r||cols<=range.e.c};
   const ws=styled?.getWorksheet(name);
   for(let c=0;c<cols;c++){
     const col=ws?.getColumn(c+1);const original=source['!cols']?.[c];
     sheet.widths.push(col?.hidden||original?.hidden?0:Math.min(800,Math.max(32,col?.width ? col.width*7+5:original?.wpx??(original?.wch ? original.wch*7+5:100))));
   }
   for(let r=0;r<rows;r++){
     const row=ws?.getRow(r+1);const original=source['!rows']?.[r];
     sheet.heights.push(row?.hidden||original?.hidden?0:Math.min(500,Math.max(22,row?.height ? row.height*4/3:original?.hpx??24)));
     sheet.cells.push(Array.from({length:cols},(_,c)=>{
       const cell=source[XLSX.utils.encode_cell({r,c})];
       if(cell?.f && cell.v==null)warnings.add('Hay fórmulas sin resultado guardado; se muestran con —.');
       return {text:cell ? cell.f&&cell.v==null?'—':cell.w??XLSX.utils.format_cell(cell):'',style:ws?styleOf(ws.getCell(r+1,c+1)):undefined};
     }));
   }
   for(const merge of source['!merges']??[]){
     if(merge.s.r>=rows||merge.s.c>=cols)continue;
     const endR=Math.min(rows-1,merge.e.r),endC=Math.min(cols-1,merge.e.c);
     sheet.cells[merge.s.r][merge.s.c].rowSpan=endR-merge.s.r+1;sheet.cells[merge.s.r][merge.s.c].colSpan=endC-merge.s.c+1;
     for(let r=merge.s.r;r<=endR;r++)for(let c=merge.s.c;c<=endC;c++)if(r!==merge.s.r||c!==merge.s.c)sheet.cells[r][c].covered=true;
   }
   if(ws && styled) for(const placement of ws.getImages().slice(0,100)){
     const img=styled.getImage(Number(placement.imageId));if(!img||!['png','jpeg','gif'].includes(img.extension))continue;
     const range=placement.range;const x=coordinate(range.tl.col,sheet.widths),y=coordinate(range.tl.row,sheet.heights);
     if(range.tl.col>=cols||range.tl.row>=rows)continue;
     const pos=range as typeof range & {ext?:{width:number;height:number}};
     const width=pos.ext?.width??(range.br?coordinate(range.br.col,sheet.widths)-x:100);
     const height=pos.ext?.height??(range.br?coordinate(range.br.row,sheet.heights)-y:100);
     let bytes:Uint8Array;
     if(img.buffer)bytes=new Uint8Array(img.buffer as unknown as ArrayBuffer);
     else if(img.base64)bytes=Uint8Array.from(atob(img.base64.split(',').pop()!),c=>c.charCodeAt(0));else continue;
     if(bytes.length>10*1024*1024)continue;
     sheet.images.push({blob:new Blob([bytes.slice().buffer],{type:'image/'+img.extension}),x,y,width,height});
   }
   sheets.push(sheet);
 }
 if(raw.SheetNames.length>50)warnings.add('Solo se muestran las primeras 50 hojas.');
 if(!sheets.length)throw new Error('El libro no contiene hojas visibles.');
 return {sheets,warnings:[...warnings]};
}
