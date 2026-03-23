import chalk from 'chalk';
import ora from 'ora';
import type { Ora } from 'ora';

let isQuiet = false;

export function setQuiet(val: boolean): void {
  isQuiet = val;
}

export function info(msg: string): void {
  if (isQuiet) return;
  console.log(chalk.blue(msg));
}

export function warn(msg: string): void {
  if (isQuiet) return;
  console.warn(chalk.yellow(msg));
}

export function error(msg: string): void {
  console.error(chalk.red(msg));
}

export function success(msg: string): void {
  if (isQuiet) return;
  console.log(chalk.green(msg));
}

export function debug(msg: string): void {
  if (isQuiet) return;
  if (!process.env['DOMAINKIT_DEBUG']) return;
  console.log(chalk.gray(msg));
}

export function createSpinner(text: string): Ora {
  return ora(text);
}
