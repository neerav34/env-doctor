import chalk from 'chalk';

let colorEnabled = true;

export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
}

function c(colorFn: (s: string) => string, msg: string): string {
  return colorEnabled ? colorFn(msg) : msg;
}

export const logger = {
  error: (msg: string): void => { process.stderr.write(c(chalk.red, msg) + '\n'); },
  warn: (msg: string): void => { process.stderr.write(c(chalk.yellow, msg) + '\n'); },
  info: (msg: string): void => { console.log(c(chalk.blue, msg)); },
  success: (msg: string): void => { console.log(c(chalk.green, msg)); },
  header: (msg: string): void => { console.log(c(chalk.bold.white, msg)); },
  dim: (msg: string): void => { console.log(c(chalk.dim, msg)); },
  log: (msg: string): void => { console.log(msg); },

  red: (msg: string): string => c(chalk.red, msg),
  yellow: (msg: string): string => c(chalk.yellow, msg),
  green: (msg: string): string => c(chalk.green, msg),
  blue: (msg: string): string => c(chalk.blue, msg),
  cyan: (msg: string): string => c(chalk.cyan, msg),
  bold: (msg: string): string => c(chalk.bold, msg),
  dim_: (msg: string): string => c(chalk.dim, msg),
  gray: (msg: string): string => c(chalk.gray, msg),
};
