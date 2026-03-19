import { Command } from 'commander';

const program = new Command();

program
  .name('domainkit')
  .alias('dk')
  .description('CLI for managing domain-focused Agent Skills')
  .version('0.1.0');

async function main() {
  const { register: initCmd } = await import('./commands/init.js');
  const { register: addCmd } = await import('./commands/add.js');
  const { register: listCmd } = await import('./commands/list.js');
  const { register: validateCmd } = await import('./commands/validate.js');
  const { register: contextCmd } = await import('./commands/context.js');
  const { register: syncCmd } = await import('./commands/sync.js');
  const { register: driftCmd } = await import('./commands/drift.js');
  const { register: serveCmd } = await import('./commands/serve.js');
  const { register: generateCmd } = await import('./commands/generate.js');

  initCmd(program);
  addCmd(program);
  listCmd(program);
  validateCmd(program);
  contextCmd(program);
  syncCmd(program);
  driftCmd(program);
  serveCmd(program);
  generateCmd(program);

  program.parse(process.argv);
}

main();
