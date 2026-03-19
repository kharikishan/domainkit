import inquirer from 'inquirer';

export async function promptInit(): Promise<{
  platform: string;
  sourceRoot: string;
  skillsDir: string;
}> {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'platform',
      message: 'Which AI platform are you targeting?',
      choices: ['claude', 'codex', 'vscode', 'cursor', 'generic'],
      default: 'generic',
    },
    {
      type: 'input',
      name: 'sourceRoot',
      message: 'Source root directory:',
      default: 'src',
    },
    {
      type: 'input',
      name: 'skillsDir',
      message: 'Skills directory:',
      default: '.skills',
    },
  ]);
}

export async function promptAddSkill(): Promise<{
  description: string;
  domain: string;
  dependencies: string;
  codePaths: string;
}> {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Skill description:',
      validate: (input: string) => input.trim().length > 0 || 'Description is required',
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Domain (e.g. auth, payments, users):',
    },
    {
      type: 'input',
      name: 'dependencies',
      message: 'Dependencies (comma-separated skill names, or leave blank):',
    },
    {
      type: 'input',
      name: 'codePaths',
      message: 'Code paths (comma-separated relative paths, or leave blank):',
    },
  ]);
}
