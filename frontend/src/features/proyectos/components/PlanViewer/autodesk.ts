// Contrato reducido de APS Viewer 7.113.0. No se exponen credenciales APS.
export interface Vector { x: number; y: number; z: number; clone(): Vector; set(x: number, y: number, z: number): Vector }
export interface Medicion {
  type: 'Distance' | 'Angle' | 'Area';
  picks: { intersection: {x: number; y: number; z: number}; modelId?: number; [key: string]: unknown }[];
  [key: string]: unknown;
}
export interface EstadoMediciones {
  schema: 1;
  mediciones: Medicion[];
  calibracion: {factor: number; unidades: string} | null;
  unidades: string;
  precision: number;
}
export interface RegistroMediciones { version: number; estado: EstadoMediciones }
export interface Measure {
  activate(mode?: string): boolean;
  deactivate(): boolean;
  getMeasurementList(): Medicion[];
  setMeasurements(measurements: Medicion[]): void;
  deleteMeasurements(): void;
  calibrateByScale(units: string, scale: number): void;
  getCalibrationFactor(): number;
  getUnits(): string;
  setUnits(units: string): void;
  getPrecision(): number;
  setPrecision(precision: number): void;
  setFreeMeasureMode(allow: boolean): void;
  restoreState(state: {measurements: Medicion[]}): void;
}
export interface Model {
  id: number;
  getBoundingBox(): {min: Vector; max: Vector};
  getDocumentNode(): {getRootNode(): {search(query: object, recursive: boolean): unknown[]}};
}
export interface Viewer {
  model: Model;
  prefs: {set(name: string, value: boolean): void};
  start(): number;
  finish(): void;
  resize(): void;
  setTheme(theme: string): void;
  loadExtension(name: string): Promise<unknown>;
  loadModel(url: string, options: object, success: (model: Model) => void, failure: () => void): void;
  waitForLoadDone(options: {geometry: boolean}): Promise<void>;
  worldToClient(point: Vector): {x: number; y: number};
  clientToWorld(x: number, y: number, ignoreTransparent?: boolean): {point: Vector} | null;
  addEventListener(name: string, handler: (event: {units?: string; scaleFactor?: number}) => void): void;
  removeEventListener(name: string, handler: () => void): void;
  toolController: {getTool(name: string): {isActive(): boolean} | undefined};
}
interface Viewing {
  Initializer(options: object, callback: () => void): void;
  GuiViewer3D: new (container: HTMLElement, options: object) => Viewer;
  CAMERA_CHANGE_EVENT: string;
  MeasureCommon: {Events: Record<string, string>};
}
declare global { interface Window { Autodesk?: {Viewing: Viewing} } }
let sdk: Promise<Viewing> | undefined;
export function cargarAutodesk(): Promise<Viewing> {
  if (!sdk) sdk = new Promise<Viewing>((resolve, reject) => {
    const base = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.113.0/';
    const inicializar = () => {
      const viewing = window.Autodesk?.Viewing;
      if (!viewing) return reject(new Error('Autodesk Viewer no está disponible.'));
      viewing.Initializer({env: 'Local', useADP: false, language: 'es'}, () => resolve(viewing));
    };
    if (window.Autodesk) return inicializar();
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = base + 'style.min.css'; document.head.append(css);
    const script = document.createElement('script'); script.src = base + 'viewer3D.min.js';
    script.onload = inicializar;
    script.onerror = () => { script.remove(); css.remove(); reject(new Error('No se pudo descargar Autodesk Viewer. Revisa tu conexión.')); };
    document.head.append(script);
  }).catch(error => { sdk = undefined; throw error; });
  return sdk;
}

// Los identificadores de modelo cambian en cada apertura; nunca se persisten.
export function normalizarMediciones(mediciones: Medicion[]): Medicion[] {
  return JSON.parse(JSON.stringify(mediciones, (key, value) => key === 'modelId' ? undefined : value)) as Medicion[];
}
export function medicionesCompletas(mediciones: Medicion[]): Medicion[] {
  return mediciones.filter(m => ['Distance', 'Angle', 'Area'].includes(m.type) &&
    m.picks.length >= (m.type === 'Distance' ? 2 : 3) && m.picks.every(p =>
      p.intersection && ['x', 'y', 'z'].every(e => Number.isFinite(p.intersection[e as 'x' | 'y' | 'z']))));
}

export function serializarEstado(estado: EstadoMediciones): string {
  return JSON.stringify(estado, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}
