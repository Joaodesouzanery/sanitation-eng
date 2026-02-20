/**
 * Core - Ponto de entrada principal para todos os módulos core
 */

// Spatial
export * from './spatial/LayerRegistry';
export * from './spatial/ProjectCRS';
export * from './spatial/SpatialCore';

// Import
export * from './import/ImportEngine';
export * from './import/NumericParser';
export * from './import/UTMValidator';
export * from './import/GeometryProcessor';

// Import Readers
export { IFCReader } from './import/readers/IFCReader';
export { INPReader } from './import/readers/INPReader';
export { DXFReader } from './import/readers/DXFReader';
export { GeoJSONReader } from './import/readers/GeoJSONReader';
export { CSVReader } from './import/readers/CSVReader';
export { SHPReader } from './import/readers/SHPReader';

// Network
export * from './network/NetworkModel';
export * from './network/TopologyRules';

// Validation
export * from './validation/ImportValidator';

// Sync
export * from './sync/ModuleSync';
