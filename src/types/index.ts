export interface EnvVarReference {
  name: string;
  file: string;
  line: number;
  column: number;
  pattern: string;
  context: string;
}

export interface EnvVarDefinition {
  name: string;
  file: string;
  line: number;
  value?: string;
  isExample: boolean;
}

export type IssueSeverity = 'error' | 'warn' | 'info';
export type IssueType = 'missing' | 'unused' | 'example-drift' | 'type-mismatch';

export interface Issue {
  severity: IssueSeverity;
  type: IssueType;
  variable: string;
  message: string;
  references?: EnvVarReference[];
  definition?: EnvVarDefinition;
  suggestion?: string;
}

export interface ScanResult {
  projectRoot: string;
  scannedFiles: number;
  skippedFiles: number;
  foundVars: Map<string, EnvVarReference[]>;
  envVars: Map<string, EnvVarDefinition>;
  exampleVars: Map<string, EnvVarDefinition>;
  issues: Issue[];
  duration: number;
}

export interface CheckOptions {
  fix: boolean;
  strict: boolean;
  envFile: string;
  exampleFile: string;
  ignore: string[];
  format: 'pretty' | 'json' | 'markdown';
  noColor: boolean;
  root: string;
}

export interface InitOptions {
  envFile: string;
  exampleFile: string;
  ignore: string[];
  withComments: boolean;
  root: string;
  noColor: boolean;
}

export type DoctorOptions = CheckOptions;

export interface HealthReport {
  score: number;
  errorCount: number;
  warnCount: number;
  breakdown: Array<{ label: string; count: number; points: number }>;
  mostProblematicFiles: Array<{ file: string; issueCount: number }>;
  recommendations: string[];
}
