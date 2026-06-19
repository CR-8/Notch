export { validateMermaidCode, detectDiagramType } from './validator';
export type { MermaidValidationResult, MermaidError, MermaidDiagramType } from './validator';
export { autoFixMermaid } from './fixer';
export type { FixResult } from './fixer';
export { getMermaidConfig, LIGHT_THEME, DARK_THEME } from './themes';
export type { MermaidThemeConfig } from './themes';
