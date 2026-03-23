import { describe, it, expect } from 'vitest';
import { modelDiffToIssues } from '../../../src/drift/model-diff.js';
import type { ModelDiff } from '../../../src/drift/model-diff.js';

describe('modelDiffToIssues', () => {
  it('returns an info issue for each added field', () => {
    const diffs: ModelDiff[] = [
      {
        modelName: 'User',
        addedFields: [
          { name: 'avatarUrl', type: 'string' },
          { name: 'bio', type: 'string' },
        ],
        removedFields: [],
        changedFields: [],
      },
    ];
    const issues = modelDiffToIssues(diffs);
    expect(issues).toHaveLength(2);
    for (const issue of issues) {
      expect(issue.type).toBe('model-mismatch');
      expect(issue.severity).toBe('info');
      expect(issue.message).toContain('exists in code');
      expect(issue.message).toContain('not in contract');
    }
    expect(issues[0].message).toContain('avatarUrl');
    expect(issues[1].message).toContain('bio');
  });

  it('returns a warning issue for each removed field', () => {
    const diffs: ModelDiff[] = [
      {
        modelName: 'Order',
        addedFields: [],
        removedFields: [{ name: 'legacyId', type: 'number' }],
        changedFields: [],
      },
    ];
    const issues = modelDiffToIssues(diffs);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('model-mismatch');
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('legacyId');
    expect(issues[0].message).toContain('documented in contract');
    expect(issues[0].message).toContain('not found in code');
  });

  it('returns a warning issue for each changed field with type info', () => {
    const diffs: ModelDiff[] = [
      {
        modelName: 'Product',
        addedFields: [],
        removedFields: [],
        changedFields: [
          { name: 'price', contractType: 'number', codeType: 'string' },
        ],
      },
    ];
    const issues = modelDiffToIssues(diffs);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('model-mismatch');
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('price');
    expect(issues[0].message).toContain('"string" in code');
    expect(issues[0].message).toContain('"number" in contract');
  });

  it('handles multiple diffs across multiple models', () => {
    const diffs: ModelDiff[] = [
      {
        modelName: 'User',
        addedFields: [{ name: 'role', type: 'string' }],
        removedFields: [{ name: 'age', type: 'number' }],
        changedFields: [],
      },
      {
        modelName: 'Post',
        addedFields: [],
        removedFields: [],
        changedFields: [
          { name: 'title', contractType: 'string', codeType: 'Text' },
        ],
      },
    ];
    const issues = modelDiffToIssues(diffs);
    // 1 added + 1 removed for User, 1 changed for Post = 3 total
    expect(issues).toHaveLength(3);
    expect(issues.filter((i) => i.message.includes('User'))).toHaveLength(2);
    expect(issues.filter((i) => i.message.includes('Post'))).toHaveLength(1);
  });

  it('returns empty array when there are no diffs', () => {
    const issues = modelDiffToIssues([]);
    expect(issues).toHaveLength(0);
  });

  it('returns empty array for a diff with no actual changes', () => {
    const diffs: ModelDiff[] = [
      {
        modelName: 'Empty',
        addedFields: [],
        removedFields: [],
        changedFields: [],
      },
    ];
    const issues = modelDiffToIssues(diffs);
    expect(issues).toHaveLength(0);
  });
});
