import Table from 'cli-table3';
import chalk from 'chalk';

export function createTable(headers: string[]): Table.Table {
  return new Table({
    head: headers.map((h) => chalk.cyan(h)),
    style: { head: [] },
  });
}

export function printTable(headers: string[], rows: string[][]): void {
  const table = createTable(headers);
  for (const row of rows) {
    table.push(row);
  }
  console.log(table.toString());
}
