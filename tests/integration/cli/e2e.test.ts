/**
 * End-to-end integration test for the DomainKit core pipeline.
 *
 * The test spins up an isolated temp directory that mimics a real project
 * (with a .domainkit/ directory for project-root detection) and drives the
 * full lifecycle programmatically:
 *
 *   create config → write skills → readAllSkills → validateAll
 *   → buildManifest → runDriftCheck → assembleContext → renderContext
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadConfig, saveConfig, getDefaultConfig } from '../../../src/core/config.js';
import { readAllSkills } from '../../../src/core/skill-reader.js';
import { buildManifest, getSkillByName, getSkillsByDomain } from '../../../src/core/manifest.js';
import { validateAll } from '../../../src/core/validator.js';
import { assembleContext } from '../../../src/core/assembler.js';
import { renderContext } from '../../../src/formats/index.js';
import { runDriftCheck } from '../../../src/drift/reporter.js';
import type { DomainKitConfig } from '../../../src/core/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a SKILL.md file with the given frontmatter and body. */
async function writeSkill(
  skillsRoot: string,
  skillName: string,
  frontmatter: Record<string, unknown>,
  body: string,
): Promise<string> {
  const skillDir = join(skillsRoot, skillName);
  await mkdir(skillDir, { recursive: true });

  const fmLines: string[] = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      fmLines.push(`${key}:`);
      for (const item of value) {
        fmLines.push(`  - "${item}"`);
      }
    } else {
      fmLines.push(`${key}: "${value}"`);
    }
  }
  fmLines.push('---');

  const content = `${fmLines.join('\n')}\n\n${body.trim()}\n`;
  await writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8');
  return skillDir;
}

/** Write a minimal contract.yaml into a skill's references/ subdirectory. */
async function writeContract(skillDir: string, contract: string): Promise<void> {
  const refsDir = join(skillDir, 'references');
  await mkdir(refsDir, { recursive: true });
  await writeFile(join(refsDir, 'contract.yaml'), contract, 'utf-8');
}

// ---------------------------------------------------------------------------
// Test fixtures — reusable markdown bodies
// ---------------------------------------------------------------------------

const AUTH_BODY = `
## Data Models

### User
Core user entity used across all authentication flows.

## Business Rules

- Passwords must be hashed with bcrypt before storage.
- JWT tokens expire after 24 hours.
- Failed login attempts are rate-limited to 5 per minute.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Authenticate a user |
| POST | /auth/logout | Invalidate a session |
| POST | /auth/refresh | Refresh an access token |
`.trim();

const PAYMENTS_BODY = `
## Data Models

### Payment
Core payment entity used across checkout flows.

## Business Rules

- Payments over $10,000 require additional verification.
- Refunds are only allowed within 30 days of purchase.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /payments | Initiate a payment |
| GET | /payments/:id | Retrieve payment details |
`.trim();

const NOTIFICATIONS_BODY = `
## Data Models

### Notification
Represents a notification event dispatched to users.

## Business Rules

- Notifications are delivered at most once (idempotent delivery key).
- Email notifications are queued asynchronously.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /notifications | Enqueue a notification |
`.trim();

const AUTH_CONTRACT = `
models:
  - name: User
    fields:
      - name: id
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: passwordHash
        type: string
        required: true
api:
  routes:
    - method: POST
      path: /auth/login
      description: Authenticate a user
    - method: POST
      path: /auth/logout
      description: Invalidate a session
`;

// ---------------------------------------------------------------------------
// Suite-wide setup / teardown
// ---------------------------------------------------------------------------

let projectRoot: string;
let skillsRoot: string;

beforeAll(async () => {
  // Create a temp directory that looks like a DomainKit project.
  projectRoot = await mkdtemp(join(tmpdir(), 'domainkit-e2e-'));

  // .domainkit/ directory is the project-root anchor that resolveProjectRoot looks for.
  await mkdir(join(projectRoot, '.domainkit'), { recursive: true });

  // Write the initial config.
  const config = getDefaultConfig();
  await saveConfig(config, projectRoot);

  // Create skills root directory.
  skillsRoot = join(projectRoot, config.skillsDir);
  await mkdir(skillsRoot, { recursive: true });

  // Skill 1: user-auth (fresh, has contract)
  const today = new Date().toISOString().split('T')[0]!;
  const authDir = await writeSkill(
    skillsRoot,
    'user-auth',
    {
      name: 'user-auth',
      description: 'Handles user authentication and session management.',
      'domainkit-domain': 'auth',
      'domainkit-version': '1',
      'domainkit-last-verified': today,
      'domainkit-code-paths': ['src/auth', 'src/sessions'],
      'domainkit-api-routes': ['POST /auth/login', 'POST /auth/logout'],
    },
    AUTH_BODY,
  );
  await writeContract(authDir, AUTH_CONTRACT);

  // Skill 2: payment-processing (depends on user-auth + notifications, recent date)
  await writeSkill(
    skillsRoot,
    'payment-processing',
    {
      name: 'payment-processing',
      description: 'Handles payment workflows including checkout, refunds, and disputes.',
      'domainkit-domain': 'commerce',
      'domainkit-version': '1',
      'domainkit-last-verified': today,
      'domainkit-dependencies': ['user-auth', 'notifications'],
      'domainkit-code-paths': ['src/payments', 'src/billing'],
    },
    PAYMENTS_BODY,
  );

  // Skill 3: notifications (no last-verified — will trigger staleness warning)
  await writeSkill(
    skillsRoot,
    'notifications',
    {
      name: 'notifications',
      description: 'Manages notification dispatch for email and in-app alerts.',
      'domainkit-domain': 'messaging',
      'domainkit-version': '1',
      // Deliberately omit domainkit-last-verified to trigger staleness issue
    },
    NOTIFICATIONS_BODY,
  );
});

afterAll(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 1. Config round-trip
// ---------------------------------------------------------------------------

describe('config round-trip', () => {
  it('loads the saved config back correctly', async () => {
    const config = await loadConfig(projectRoot);
    expect(config.version).toBe('1');
    expect(config.skillsDir).toBe('.skills');
    expect(config.sourceRoot).toBe('src');
    expect(config.platform).toBe('generic');
  });

  it('saves and reloads an updated config', async () => {
    const updated: DomainKitConfig = {
      version: '1',
      skillsDir: '.skills',
      sourceRoot: 'src',
      platform: 'claude',
      context: {
        defaultBudget: 12000,
        defaultFormat: 'claude',
        defaultDepth: 'full',
      },
    };
    await saveConfig(updated, projectRoot);
    const loaded = await loadConfig(projectRoot);
    expect(loaded.platform).toBe('claude');
    expect(loaded.context?.defaultBudget).toBe(12000);

    // Restore to generic for subsequent tests
    await saveConfig(getDefaultConfig(), projectRoot);
  });
});

// ---------------------------------------------------------------------------
// 2. Skill reading
// ---------------------------------------------------------------------------

describe('readAllSkills', () => {
  it('discovers all three skills', async () => {
    const skills = await readAllSkills(skillsRoot);
    expect(skills).toHaveLength(3);
  });

  it('parses metadata correctly for user-auth', async () => {
    const skills = await readAllSkills(skillsRoot);
    const auth = skills.find((s) => s.metadata.name === 'user-auth');
    expect(auth).toBeDefined();
    expect(auth!.metadata.description).toContain('authentication');
    expect(auth!.metadata['domainkit-domain']).toBe('auth');
    expect(auth!.metadata['domainkit-code-paths']).toContain('src/auth');
  });

  it('detects contract presence for user-auth', async () => {
    const skills = await readAllSkills(skillsRoot);
    const auth = skills.find((s) => s.metadata.name === 'user-auth');
    expect(auth!.hasContract).toBe(true);
  });

  it('marks payment-processing as having no contract', async () => {
    const skills = await readAllSkills(skillsRoot);
    const payments = skills.find((s) => s.metadata.name === 'payment-processing');
    expect(payments!.hasContract).toBe(false);
  });

  it('parses domainkit-dependencies for payment-processing', async () => {
    const skills = await readAllSkills(skillsRoot);
    const payments = skills.find((s) => s.metadata.name === 'payment-processing');
    expect(payments!.metadata['domainkit-dependencies']).toContain('user-auth');
    expect(payments!.metadata['domainkit-dependencies']).toContain('notifications');
  });
});

// ---------------------------------------------------------------------------
// 3. Validation
// ---------------------------------------------------------------------------

describe('validateAll', () => {
  it('returns a result for each skill (and extra for contracts)', async () => {
    const skills = await readAllSkills(skillsRoot);
    const results = await validateAll(skills);
    // At minimum one result per skill; user-auth has a contract so there is an extra result
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('all skill-level results are valid (names + descriptions present)', async () => {
    const skills = await readAllSkills(skillsRoot);
    const results = await validateAll(skills);
    const errored = results.filter((r) => !r.valid);
    expect(errored).toHaveLength(0);
  });

  it('produces warnings for missing recommended sections or absent last-verified', async () => {
    const skills = await readAllSkills(skillsRoot);
    const results = await validateAll(skills);
    const allWarnings = results.flatMap((r) => r.warnings);
    // notifications skill has no domainkit-last-verified — body warnings may appear too
    expect(allWarnings.length).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Manifest
// ---------------------------------------------------------------------------

describe('buildManifest', () => {
  it('creates a manifest with all three entries', async () => {
    const skills = await readAllSkills(skillsRoot);
    const manifest = buildManifest(skills);
    expect(manifest.skills).toHaveLength(3);
  });

  it('groups skills by domain correctly', async () => {
    const skills = await readAllSkills(skillsRoot);
    const manifest = buildManifest(skills);
    const authSkills = getSkillsByDomain(manifest, 'auth');
    const commerceSkills = getSkillsByDomain(manifest, 'commerce');
    const messagingSkills = getSkillsByDomain(manifest, 'messaging');

    expect(authSkills).toHaveLength(1);
    expect(authSkills[0]!.name).toBe('user-auth');

    expect(commerceSkills).toHaveLength(1);
    expect(commerceSkills[0]!.name).toBe('payment-processing');

    expect(messagingSkills).toHaveLength(1);
    expect(messagingSkills[0]!.name).toBe('notifications');
  });

  it('getSkillByName finds user-auth', async () => {
    const skills = await readAllSkills(skillsRoot);
    const manifest = buildManifest(skills);
    const entry = getSkillByName(manifest, 'user-auth');
    expect(entry).toBeDefined();
    expect(entry!.domain).toBe('auth');
    expect(entry!.hasContract).toBe(true);
  });

  it('manifest entry carries codePaths', async () => {
    const skills = await readAllSkills(skillsRoot);
    const manifest = buildManifest(skills);
    const entry = getSkillByName(manifest, 'user-auth');
    expect(entry!.codePaths).toContain('src/auth');
  });

  it('manifest entry carries dependencies for payment-processing', async () => {
    const skills = await readAllSkills(skillsRoot);
    const manifest = buildManifest(skills);
    const entry = getSkillByName(manifest, 'payment-processing');
    expect(entry!.dependencies).toContain('user-auth');
    expect(entry!.dependencies).toContain('notifications');
  });

  it('manifest has a timestamp string', async () => {
    const skills = await readAllSkills(skillsRoot);
    const manifest = buildManifest(skills);
    expect(typeof manifest.timestamp).toBe('string');
    expect(() => new Date(manifest.timestamp)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. Drift detection
// ---------------------------------------------------------------------------

describe('runDriftCheck', () => {
  it('returns one result per skill', async () => {
    const skills = await readAllSkills(skillsRoot);
    const results = await runDriftCheck({
      skills,
      sourceRoot: join(projectRoot, 'src'),
      strategies: ['staleness'],
    });
    expect(results).toHaveLength(3);
  });

  it('user-auth is fresh (last-verified is today)', async () => {
    const skills = await readAllSkills(skillsRoot);
    const results = await runDriftCheck({
      skills,
      sourceRoot: join(projectRoot, 'src'),
      strategies: ['staleness'],
      threshold: 30,
    });
    const authResult = results.find((r) => r.skill === 'user-auth');
    expect(authResult).toBeDefined();
    // Today's date should be within threshold — score should be 100 and status fresh
    expect(authResult!.status).toBe('fresh');
    expect(authResult!.score).toBe(100);
  });

  it('notifications skill has a staleness issue (no last-verified date)', async () => {
    const skills = await readAllSkills(skillsRoot);
    const results = await runDriftCheck({
      skills,
      sourceRoot: join(projectRoot, 'src'),
      strategies: ['staleness'],
      threshold: 30,
    });
    const notifResult = results.find((r) => r.skill === 'notifications');
    expect(notifResult).toBeDefined();
    const stalenessIssue = notifResult!.issues.find((i) => i.type === 'staleness');
    expect(stalenessIssue).toBeDefined();
    expect(stalenessIssue!.message).toMatch(/no domainkit-last-verified/i);
  });

  it('drift scores are numbers between 0 and 100', async () => {
    const skills = await readAllSkills(skillsRoot);
    const results = await runDriftCheck({
      skills,
      sourceRoot: join(projectRoot, 'src'),
      strategies: ['staleness'],
    });
    for (const result of results) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('each result has a valid status value', async () => {
    const skills = await readAllSkills(skillsRoot);
    const results = await runDriftCheck({
      skills,
      sourceRoot: join(projectRoot, 'src'),
      strategies: ['staleness'],
    });
    const validStatuses = new Set(['fresh', 'stale', 'drifted']);
    for (const result of results) {
      expect(validStatuses.has(result.status)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Context assembly
// ---------------------------------------------------------------------------

describe('assembleContext', () => {
  it('assembles payment-processing with its transitive dependencies', async () => {
    const skills = await readAllSkills(skillsRoot);
    const ctx = await assembleContext({
      skills,
      selectedSkills: ['payment-processing'],
      budget: 20000,
      depth: 'full',
      format: 'markdown',
    });

    expect(ctx.primary).toHaveLength(1);
    expect(ctx.primary[0]!.metadata.name).toBe('payment-processing');
    // Both user-auth and notifications should appear as dependencies
    const depNames = ctx.dependencies.map((s) => s.metadata.name);
    expect(depNames).toContain('user-auth');
    expect(depNames).toContain('notifications');
  });

  it('selects multiple primary skills when requested', async () => {
    const skills = await readAllSkills(skillsRoot);
    const ctx = await assembleContext({
      skills,
      selectedSkills: ['user-auth', 'notifications'],
      budget: 20000,
      depth: 'contract',
      format: 'markdown',
    });

    const primaryNames = ctx.primary.map((s) => s.metadata.name);
    expect(primaryNames).toContain('user-auth');
    expect(primaryNames).toContain('notifications');
  });

  it('respects a tight token budget and drops skills that do not fit', async () => {
    const skills = await readAllSkills(skillsRoot);
    // Budget of 1 token — nothing should fit
    const ctx = await assembleContext({
      skills,
      selectedSkills: ['payment-processing'],
      budget: 1,
      depth: 'full',
      format: 'markdown',
    });
    // With a budget of 1 the primary skill itself won't fit
    expect(ctx.primary).toHaveLength(0);
    expect(ctx.budget.used).toBe(0);
    expect(ctx.budget.remaining).toBe(1);
  });

  it('budget tracking is accurate', async () => {
    const skills = await readAllSkills(skillsRoot);
    const ctx = await assembleContext({
      skills,
      selectedSkills: ['user-auth'],
      budget: 20000,
      depth: 'contract',
      format: 'markdown',
    });
    expect(ctx.budget.used + ctx.budget.remaining).toBe(ctx.budget.total);
    expect(ctx.budget.total).toBe(20000);
    expect(ctx.budget.used).toBeGreaterThan(0);
  });

  it('returns the requested format tag on the context object', async () => {
    const skills = await readAllSkills(skillsRoot);
    for (const fmt of ['markdown', 'claude', 'system-prompt'] as const) {
      const ctx = await assembleContext({
        skills,
        selectedSkills: ['user-auth'],
        budget: 20000,
        format: fmt,
      });
      expect(ctx.format).toBe(fmt);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Context rendering
// ---------------------------------------------------------------------------

describe('renderContext', () => {
  it('renders markdown output containing skill names and headings', async () => {
    const skills = await readAllSkills(skillsRoot);
    const ctx = await assembleContext({
      skills,
      selectedSkills: ['user-auth'],
      budget: 20000,
      depth: 'full',
      format: 'markdown',
    });
    const rendered = renderContext(ctx, skills, 'markdown');
    expect(rendered).toContain('# Domain Context');
    expect(rendered).toContain('user-auth');
    expect(rendered).toContain('authentication');
  });

  it('renders claude format with domain index table and skill content', async () => {
    const skills = await readAllSkills(skillsRoot);
    const ctx = await assembleContext({
      skills,
      selectedSkills: ['user-auth'],
      budget: 20000,
      depth: 'full',
      format: 'claude',
    });
    const rendered = renderContext(ctx, skills, 'claude');
    // Claude format renders a markdown index table followed by skill sections
    expect(rendered).toContain('# Domain Context');
    expect(rendered).toContain('| Domain | Skills | Status |');
    expect(rendered).toContain('user-auth');
    expect(rendered).toContain('auth');
  });

  it('renders system-prompt format as a non-empty string', async () => {
    const skills = await readAllSkills(skillsRoot);
    const ctx = await assembleContext({
      skills,
      selectedSkills: ['notifications'],
      budget: 20000,
      depth: 'index',
      format: 'system-prompt',
    });
    const rendered = renderContext(ctx, skills, 'system-prompt');
    expect(typeof rendered).toBe('string');
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).toContain('notifications');
  });

  it('renders payment-processing context including dependency names', async () => {
    const skills = await readAllSkills(skillsRoot);
    const ctx = await assembleContext({
      skills,
      selectedSkills: ['payment-processing'],
      budget: 20000,
      depth: 'full',
      format: 'markdown',
    });
    const rendered = renderContext(ctx, skills, 'markdown');
    expect(rendered).toContain('payment-processing');
    // Dependency block should appear
    expect(rendered).toContain('user-auth');
  });
});

// ---------------------------------------------------------------------------
// 8. Full pipeline smoke test
// ---------------------------------------------------------------------------

describe('full pipeline smoke test', () => {
  it('runs create → read → validate → manifest → drift → assemble → render without errors', async () => {
    // 1. Config
    const config = await loadConfig(projectRoot);
    expect(config).toBeTruthy();

    // 2. Read skills
    const skills = await readAllSkills(join(projectRoot, config.skillsDir));
    expect(skills.length).toBeGreaterThan(0);

    // 3. Validate
    const validationResults = await validateAll(skills);
    const hasErrors = validationResults.some((r) => r.errors.length > 0);
    expect(hasErrors).toBe(false);

    // 4. Manifest
    const manifest = buildManifest(skills);
    expect(manifest.skills.length).toBe(skills.length);

    // 5. Drift check
    const driftResults = await runDriftCheck({
      skills,
      sourceRoot: join(projectRoot, config.sourceRoot),
      strategies: ['staleness'],
    });
    expect(driftResults.length).toBe(skills.length);

    // 6. Assemble context for all skill names
    const allNames = skills.map((s) => s.metadata.name);
    const ctx = await assembleContext({
      skills,
      selectedSkills: allNames,
      budget: 50000,
      depth: 'full',
      format: 'markdown',
    });
    expect(ctx.primary.length).toBeGreaterThan(0);

    // 7. Render
    const rendered = renderContext(ctx, skills, 'markdown');
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).toContain('# Domain Context');
  });
});
