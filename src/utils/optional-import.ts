const installProfiles: Record<string, string> = {
  'ts-morph': 'pnpm add ts-morph    # needed for drift detection and code generation',
  'natural': 'pnpm add natural      # needed for intelligent task-to-domain matching',
  '@modelcontextprotocol/sdk': 'pnpm add @modelcontextprotocol/sdk  # needed for MCP server',
};

export async function requireOptional<T = unknown>(
  packageName: string,
  feature: string,
): Promise<T> {
  try {
    const mod = await import(packageName);
    return mod as T;
  } catch {
    const installCmd = installProfiles[packageName] ?? `pnpm add ${packageName}`;
    throw new Error(
      `The "${packageName}" package is required for ${feature} but is not installed.\n\n` +
      `Install it with:\n  ${installCmd}\n`,
    );
  }
}
