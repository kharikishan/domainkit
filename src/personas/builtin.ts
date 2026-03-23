import type { PersonaDefinition } from './types.js';

export const BUILTIN_PERSONAS: PersonaDefinition[] = [
  {
    id: 'developer',
    name: 'Developer',
    description: 'Focuses on architecture, code patterns, dependencies, API usage, and development setup',
    focusAreas: [
      'architecture',
      'code patterns',
      'dependencies',
      'API usage',
      'setup and development workflow',
    ],
    sections: [
      {
        heading: '## Architecture Overview',
        prompt: 'Describe the high-level architecture of this module: key components, layers, and how they interact.',
        required: true,
      },
      {
        heading: '## Code Patterns',
        prompt: 'Document the primary design patterns used: factories, repositories, middleware chains, event handlers, etc.',
        required: true,
      },
      {
        heading: '## Key Dependencies',
        prompt: 'List the critical internal and external dependencies, what they provide, and why they were chosen.',
        required: true,
      },
      {
        heading: '## API Usage',
        prompt: 'Document the public API surface: exported functions, classes, hooks, or endpoints that consumers use.',
        required: true,
      },
      {
        heading: '## Setup & Development',
        prompt: 'How to set up a local dev environment for this module: env vars, database seeds, required services.',
        required: false,
      },
    ],
    promptContext:
      'You are a software developer examining this module for the first time. Focus on what you need to understand to start contributing: architecture, patterns, dependencies, and how to run things locally.',
    priority: 'primary',
  },
  {
    id: 'domain-expert',
    name: 'Domain Expert',
    description: 'Focuses on business rules, invariants, domain events, edge cases, and bounded context boundaries',
    focusAreas: [
      'business rules',
      'invariants',
      'domain events',
      'edge cases',
      'bounded context',
    ],
    sections: [
      {
        heading: '## Business Rules',
        prompt: 'Document the core business rules and logic that this domain enforces. Include validation rules, state transitions, and calculation formulas.',
        required: true,
      },
      {
        heading: '## Invariants',
        prompt: 'List the invariants that must always hold true: data consistency rules, referential integrity constraints, and business constraints that must never be violated.',
        required: true,
      },
      {
        heading: '## Domain Events',
        prompt: 'Document the domain events emitted and consumed: what triggers them, what data they carry, and what downstream effects they have.',
        required: true,
      },
      {
        heading: '## Edge Cases & Gotchas',
        prompt: 'Document non-obvious edge cases, race conditions, and gotchas that developers commonly trip over.',
        required: true,
      },
      {
        heading: '## Bounded Context',
        prompt: 'Define the boundaries of this domain: what it owns, what it delegates, and how it communicates with adjacent domains.',
        required: false,
      },
    ],
    promptContext:
      'You are a domain expert examining this module. Focus on business logic, not technical implementation. What rules does this domain enforce? What can go wrong? What are the boundaries?',
    priority: 'primary',
  },
];
