# Brownfield Guide: Adopting DomainKit in Existing Codebases

This guide covers how to introduce DomainKit into a project that already has code. The key insight: **extract and codify tribal knowledge** so AI agents can work safely in your codebase without breaking things they don't understand.

## Why DomainKit for Brownfield?

Existing codebases have accumulated knowledge that lives in people's heads — business rules, edge cases, architectural decisions, and "don't touch that" warnings. Without this context, AI agents:

- Build features on abandoned patterns
- Break invariants they don't know exist
- Produce code that passes tests but violates business rules
- Generate inconsistent implementations across related domains

DomainKit lets you extract this knowledge into structured, validated, drift-checked skills that any agent can consume.

## Phase 1: Assessment

### Initialize DomainKit

```bash
cd /path/to/your/project
dk init --platform claude --source-root src
```

### Scan Your Codebase

Use the generate command to discover modules eligible for skills:

```bash
dk generate --scan
```

This analyzes your source code and reports:
- Discovered modules (directories with models, routes, or services)
- Detected frameworks (Express, Next.js, etc.)
- Suggested domain boundaries
- Estimated skill count

**Example output:**
```
Scanning src/ for modules...

Found 12 potential modules:
  src/modules/auth/         → auth (3 models, 6 routes)
  src/modules/users/        → users (2 models, 4 routes)
  src/modules/billing/      → billing (4 models, 5 routes)
  src/modules/projects/     → projects (3 models, 8 routes)
  src/modules/tasks/        → tasks (2 models, 7 routes)
  src/modules/notifications/ → notifications (1 model, 3 routes)
  ...

Suggested: Start with auth, billing, tasks (highest route count)
```

### Prioritize Domains

Don't try to skill-ify everything at once. Start with:

1. **High-risk domains** — where bugs are expensive (payments, auth, data integrity)
2. **Frequently-changed domains** — where agents are most likely to work
3. **Complex domains** — where tribal knowledge is deepest (the "ask Sarah" code)
4. **Integration boundaries** — where multiple domains interact

## Phase 2: Auto-Generate Skill Drafts

### Bootstrap from Code

```bash
# Generate skills for all discovered modules
dk generate --bootstrap --with-contracts --persona domain-expert

# Or target specific modules
dk generate --bootstrap --modules auth,billing,tasks --with-contracts

# Preview without writing files
dk generate --bootstrap --dry-run
```

This creates skill drafts by:
1. Extracting TypeScript types and interfaces (`ts-morph`)
2. Discovering Express/Next.js routes
3. Generating `SKILL.md` with pre-filled data models and API surface
4. Creating `contract.yaml` with extracted models and routes

**What you get:**
```
skills/
  auth/
    SKILL.md              # Pre-filled with extracted types and routes
    references/
      contract.yaml       # Models and routes from source code
  billing/
    SKILL.md
    references/
      contract.yaml
  tasks/
    SKILL.md
    references/
      contract.yaml
```

### What Auto-Generation Captures

| Captured Automatically | Must Be Added Manually |
|----------------------|----------------------|
| TypeScript type definitions | Business rules and invariants |
| API route paths and methods | Gotchas and edge cases |
| Model field names and types | Why decisions were made |
| Import dependencies | Non-obvious behaviors |
| File structure | Testing priorities |

### Use Smart Recommendations

After making code changes, use `dk recommend` to see which skills need attention:

```bash
dk recommend
dk recommend --staged
```

## Phase 3: Enrich Skills with Domain Knowledge

Auto-generated skills are a starting point. The real value comes from the knowledge that **isn't in the code**.

### For Each Skill, Add:

#### Business Rules

Interview domain experts or review PR history. Document the invariants:

```markdown
## Business Rules

- Cancellation triggers full refund + inventory restoration atomically
- Returns allowed within 30 days of delivery only
- After status = shipped, only tracking number and status can change
- Product snapshots are taken at order time — order displays snapshot, not live product
```

#### Gotchas

These are the things that cause bugs when someone doesn't know them:

```markdown
## Gotchas

- DELETE /api/products/:id archives, it does NOT hard-delete
- Guest cart merge sums quantities up to inventory cap, doesn't replace
- Price is locked at cart-add time (snapshot), NOT at checkout time
- Webhook events from Stripe can arrive out of order — always check current state
- The `amount` field is in cents (integer), never dollars (float)
```

#### Testing Priorities

What breaks when this domain changes? What must always be verified?

```markdown
## Testing Priorities

1. Inventory reservation atomicity (partial reservation must rollback all)
2. Webhook signature verification (Stripe signing secret)
3. Idempotent event processing (replay same webhook twice)
4. State machine transitions (every valid and invalid transition)
5. Price divergence detection (>5% between cart and current price)
```

#### Dependencies

If auto-detection missed relationships, add them:

```yaml
---
name: checkout
domainkit-dependencies: cart,catalog,payments,inventory
---
```

## Phase 4: Validate and Baseline

### Validate All Skills

```bash
dk validate --strict
```

Common issues to fix:
- Missing `domainkit-code-paths` (add glob patterns for source files)
- Dependencies referencing non-existent skills (create the missing skill or remove the dependency)
- Stale `domainkit-last-verified` date (update to today)

### Run Initial Drift Check

```bash
dk drift
```

This establishes your baseline. You'll likely see some drift in auto-generated skills because:
- Some code paths may not match perfectly
- Routes may have changed since generation
- Types may have been extracted incompletely

Fix the most critical issues now; track the rest.

### Review Drift Report

```bash
# Detailed markdown report
dk drift --report md

# Machine-readable for CI
dk drift --report json
```

**Example output:**
```
Drift Report
============

  auth         Score: 95  Status: fresh
  billing      Score: 72  Status: stale     ⚠ 2 warnings
  tasks        Score: 88  Status: fresh
  checkout     Score: 45  Status: drifted   ✗ 3 errors

Details:
  billing:
    ⚠ warning: domainkit-last-verified is 45 days old (threshold: 30)
    ⚠ warning: src/modules/billing/webhooks.ts not covered by code-paths

  checkout:
    ✗ error: domainkit-last-verified is 90 days old (threshold: 30)
    ⚠ warning: Route POST /api/checkout/apply-coupon found in code but not in contract
    ⚠ warning: 3 files in src/modules/checkout/ not covered by code-paths
```

## Phase 5: Integrate with Your Workflow

### Sync to Agent Platforms

```bash
# Preview what would be synced
dk sync --all --dry-run

# Sync to all configured platforms
dk sync --all

# Target specific platform
dk sync --target claude
```

`dk sync` copies skills to each platform's standard directory via the Agent Skills standard — one format, every platform.

### Watch Mode

For continuous monitoring during development:

```bash
dk watch
```

### Start MCP Server (for Claude Desktop)

```bash
dk serve --transport stdio
```

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "domainkit": {
      "command": "dk",
      "args": ["serve", "--transport", "stdio"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Add to CI/CD

**Drift check on PRs:**

```yaml
# .github/workflows/drift.yml
name: Domain Drift Check
on: [pull_request]
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: npx dk validate --strict
      - run: npx dk drift --report json --threshold 50
```

**Validate skills on commit:**

```yaml
# Add to existing CI
- run: npx dk validate --strict
```

### Use Context Assembly

When giving tasks to agents, assemble the right context:

```bash
# Natural language — DomainKit picks the right domains
dk context "fix the payment retry bug" --format claude

# Explicit domains
dk context --domains payments,orders --format system-prompt

# Pipe to clipboard
dk context "add email verification" --format claude | pbcopy

# Save to file
dk context --domains auth --depth full --format claude -o auth-context.md
```

## Phase 6: Incremental Expansion

### Add New Domains Over Time

As you skill-ify more of your codebase:

```bash
# Scan for new modules not yet covered
dk generate --scan

# Generate drafts for specific new modules
dk generate --bootstrap --modules notifications,reporting

# Or manually create skills
dk add notifications --domain notifications \
  --description "Email and in-app notification delivery" \
  --deps tasks,projects
```

### Update Existing Skills

When code changes, update the corresponding skill:

1. Update the skill content to reflect the change
2. Update `domainkit-last-verified` to today's date
3. Update `contract.yaml` if the interface changed
4. Run `dk validate` to verify

### Monitor Drift Trends

Run drift checks regularly and track the trend:

```bash
# Weekly drift report
dk drift --report json > drift-$(date +%Y%m%d).json
```

## Incremental Adoption Strategy

You don't need 100% coverage to get value. Here's a phased approach:

### Week 1-2: Foundation

- `dk init`
- Scan codebase, identify top 3-5 priority domains
- Auto-generate + enrich those skills
- Validate and baseline

### Week 3-4: Integration

- Sync to agent platform
- Start using `dk context` for agent tasks
- Add validation to CI
- Train team on updating skills after code changes

### Month 2: Expansion

- Add 3-5 more domains
- Start MCP server for real-time context
- Add drift checks to CI
- Review and improve initial skills based on agent output quality

### Month 3+: Maintenance

- All actively-developed domains have skills
- Drift checks run on every PR
- Skills updated as part of the development workflow
- New team members onboard through skills

## Brownfield Checklist

- [ ] `dk init` with your target platform
- [ ] `dk generate --scan` to discover modules
- [ ] Prioritize top 3-5 domains
- [ ] `dk generate --bootstrap --with-contracts` for priority domains
- [ ] Enrich each skill: business rules, gotchas, testing priorities
- [ ] `dk validate --strict` — all clean
- [ ] `dk drift` — establish baseline
- [ ] `dk sync --all` or `dk serve`
- [ ] Add `dk validate` and `dk drift` to CI
- [ ] Schedule monthly drift reviews
- [ ] Expand to remaining domains incrementally

## Tips for Brownfield Success

1. **Start small.** 3-5 well-written skills beat 20 shallow ones. Depth matters more than breadth.

2. **Gotchas are gold.** The most valuable content is what's NOT obvious from reading the code. Interview the person who wrote it.

3. **Update skills in the same PR as code changes.** Don't let them drift. If you change the checkout flow, update the checkout skill in the same commit.

4. **Use drift detection as a forcing function.** A failing drift check on a PR is a prompt to update the skill — not a burden, but a reminder to keep context accurate.

5. **Don't over-specify.** Skills should capture domain knowledge, not replicate the code. An agent can read the code; it can't read the reasoning behind it.

6. **Review agent output quality.** If an agent produces bad code in a specific domain, that's a signal the skill needs improvement. Iterate.
