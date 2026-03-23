# MCP Integration Guide

DomainKit includes a built-in [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets AI agents request domain context on-demand, rather than pre-loading everything.

## Overview

The MCP server exposes DomainKit's capabilities as tools that agents can call during a conversation:

| Tool | Purpose |
|------|---------|
| `list_domains` | Discover all available domains and skills |
| `get_context` | Assemble context for a task or set of domains |
| `get_skill` | Fetch a single skill at any depth |
| `check_drift` | Run drift detection on skills |
| `get_dependencies` | Resolve a skill's dependency graph |

This means an agent can:
1. List available domains to understand the project
2. Request specific domain context for the current task
3. Check if a skill is up to date before relying on it
4. Understand dependencies before making cross-domain changes

## Prerequisites

Install the MCP SDK:

```bash
pnpm add @modelcontextprotocol/sdk
```

## Starting the Server

### stdio Transport (Recommended)

Used by Claude Desktop, Cursor, and most local MCP clients:

```bash
dk serve --transport stdio
```

The server communicates via stdin/stdout using the MCP protocol.

### SSE Transport

For web-based clients or remote connections:

```bash
dk serve --transport sse --port 8080
```

The server starts an HTTP endpoint at `http://localhost:8080` using Server-Sent Events.

## Client Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "domainkit": {
      "command": "dk",
      "args": ["serve", "--transport", "stdio"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

**With npx (if not globally installed):**
```json
{
  "mcpServers": {
    "domainkit": {
      "command": "npx",
      "args": ["domainkit", "serve", "--transport", "stdio"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

### Claude Code

Add to your project's `.claude/settings.json` or user settings:

```json
{
  "mcpServers": {
    "domainkit": {
      "command": "dk",
      "args": ["serve", "--transport", "stdio"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

### Cursor

Add to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "domainkit": {
      "command": "dk",
      "args": ["serve", "--transport", "stdio"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

### VS Code (with MCP Extension)

If using an MCP-compatible VS Code extension, configure it to launch:

```json
{
  "mcp.servers": {
    "domainkit": {
      "command": "dk",
      "args": ["serve", "--transport", "stdio"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

## MCP Tools Reference

### list_domains

Lists all domains and their skills.

**Input:** None

**Output:**
```json
{
  "domains": [
    {
      "name": "payments",
      "skills": [
        {
          "name": "payments",
          "description": "Stripe payment processing and refunds",
          "dependencies": ["orders"],
          "lastVerified": "2026-03-15"
        }
      ]
    },
    {
      "name": "orders",
      "skills": [
        {
          "name": "orders",
          "description": "Order lifecycle, fulfillment, and returns",
          "dependencies": ["payments"],
          "lastVerified": "2026-03-15"
        }
      ]
    }
  ]
}
```

**When an agent uses this:** At the start of a conversation to understand what domains exist, or when deciding which domains are relevant to a task.

---

### get_context

Assembles context for a task or set of domains, respecting token budgets.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task` | string | No* | Natural language task description |
| `domains` | string[] | No* | List of domain names |
| `budget` | number | No | Token budget (default: 8000) |
| `format` | string | No | Output format: `claude`, `system-prompt`, `markdown` |
| `depth` | string | No | Context depth: `index`, `contract`, `full` |

*Either `task` or `domains` must be provided.

**Output:** Rendered context string in the requested format.

**When an agent uses this:** When it needs domain knowledge to complete a task. The agent can either describe the task (auto-matching) or specify domains directly.

---

### get_skill

Fetches a single skill at the specified depth.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Skill name |
| `depth` | string | No | `index`, `contract`, or `full` (default: `full`) |

**Output:**
- **index**: Name and description only
- **contract**: Data models, API surface, business rules
- **full**: Complete skill body

**When an agent uses this:** When it needs detailed information about one specific domain, or to drill into a skill it found via `list_domains`.

---

### check_drift

Runs drift detection on one or all skills.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill` | string | No | Specific skill to check (default: all) |

**Output:**
```json
{
  "results": [
    {
      "skill": "payments",
      "score": 95,
      "status": "fresh",
      "issues": []
    },
    {
      "skill": "checkout",
      "score": 45,
      "status": "drifted",
      "issues": [
        {
          "type": "staleness",
          "severity": "error",
          "message": "Last verified 90 days ago (threshold: 30)"
        },
        {
          "type": "file-coverage",
          "severity": "warning",
          "message": "Route POST /api/checkout/apply-coupon found in code but not in contract"
        }
      ]
    }
  ]
}
```

**When an agent uses this:** Before relying on a skill's content, to verify it's up to date. If a skill is drifted, the agent can warn the user or ask for verification.

---

### get_dependencies

Resolves the full transitive dependency graph for a skill.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill` | string | Yes | Skill name |

**Output:**
```json
{
  "skill": "checkout",
  "directDependencies": ["cart", "catalog", "payments", "inventory"],
  "transitiveDependencies": ["orders"],
  "fullGraph": {
    "checkout": ["cart", "catalog", "payments", "inventory"],
    "payments": ["orders"],
    "inventory": ["catalog"]
  },
  "hasCycles": false
}
```

**When an agent uses this:** When planning cross-domain changes, to understand the full impact of a modification.

## How Agents Use DomainKit MCP

### Typical Agent Workflow

1. **Discovery**: Agent calls `list_domains` to see what's available
2. **Task matching**: Agent calls `get_context` with the user's task description
3. **Deep dive**: If needed, agent calls `get_skill` for full details on a specific domain
4. **Verification**: Agent calls `check_drift` to ensure context is current
5. **Planning**: Agent calls `get_dependencies` to understand cross-domain impact

### Example Agent Interaction

**User:** "Fix the bug where checkout doesn't validate the coupon expiry date"

**Agent thinks:** This involves the checkout domain, probably the cart domain too.

**Agent calls `get_context`:**
```json
{ "task": "fix checkout coupon expiry validation", "depth": "full" }
```

**Agent receives:** Full checkout skill with business rules about coupon validation, cart skill with coupon handling, plus index-level context for payments and inventory.

**Agent calls `check_drift`:**
```json
{ "skill": "checkout" }
```

**Agent receives:** Score 88, status fresh — safe to rely on.

**Agent proceeds** with the fix, knowing the exact business rules, data models, and gotchas.

## Troubleshooting

### Server Won't Start

**"Cannot find module '@modelcontextprotocol/sdk'"**

Install the optional dependency:
```bash
pnpm add @modelcontextprotocol/sdk
```

### Client Can't Connect

1. Verify the `cwd` path is correct and contains `.domainkit/config.yaml`
2. Verify `dk serve --transport stdio` works when run manually in that directory
3. Check the client's MCP logs for connection errors

### Tools Not Appearing

1. Restart the MCP client after configuration changes
2. Verify skills exist: `dk list` should show results
3. Check that `.domainkit/config.yaml` has the correct `skillsDir` path

### Slow Context Assembly

- Reduce the token budget: `"budget": 4000`
- Use `contract` depth instead of `full`
- Pre-filter with specific domain names instead of task matching
