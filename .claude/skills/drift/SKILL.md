---
name: drift
description: Enforces the consolidation of similar API operations and database queries to prevent method drift, utilizing JS and JSDoc.
---

# Prevent API Drift: Grouping Similar Operations

## Context

When expanding functionality, isolated methods often diverge in how they handle errors, authentication, and JSDoc types. To maintain consistency within the Next.js App Router and Prisma database environments, all related data fetching, mutations, and API routes must be grouped by domain entity.

## Execution Requirements

1. **Scan Before Creating:** Before scaffolding a new file in `src/lib/` or `src/app/api/`, search for an existing domain file. For instance, new site-related database reads belong in `src/lib/sites/siteLookup.js`, writes belong in `src/lib/sites/siteMutations.js`, and page taxonomy picker selection logic belongs in `src/lib/taxonomy/taxonomyScope.js` (not a separate picker helper file).
2. **Use Optional Parameters:** Extend existing JSDoc signatures with optional parameters `[paramName]` to handle slight variations in logic rather than duplicating the function.
3. **Hook Aggregation:** When creating React hooks for data fetching or mutations in `src/lib/hooks/`, group related endpoints into a single hook returning multiple functions.
4. **JSDoc Centralization:** Prevent type drift by defining standard `@typedef` payloads for your API routes and reusing them across all methods in that file.
5. **Client registry:** When adding or changing a Route Handler consumed by the UI, add or update a row in `src/lib/api/entityCrudRegistry.js` (`verified: true` only after reading the handler). New client mutations should call `crud()` — see `.claude/skills/client-crud/SKILL.md`.

## Code Patterns

### ❌ Anti-Pattern (Drift via Fragmentation)

Scattering related operations into single-purpose functions without shared parameterization.

```javascript
// src/lib/pages/publishPage.js
/**
 * @param {string} rkey
 */
export async function publishPage(rkey) {
  // Drift: Uniquely implemented error handling
}

// src/lib/pages/unpublishPage.js
/**
 * @param {string} rkey
 */
export async function unpublishPage(rkey) {
  // Drift: No shared types or error handling
}
```

// src/lib/pages/pageMutations.js
import { prisma } from '../prisma.js';

/\*\*

- @typedef {'publish' | 'unpublish' | 'archive'} PageAction
  \*/

/\*\*

- @typedef {Object} PageMutationResult
- @property {boolean} success
- @property {string} rkey
- @property {Date} updatedAt
  \*/

export const pageMutations = {
/\*\*

- Modifies the publication state of a page.
- Groups publish, unpublish, and archive operations to prevent drift.
-
- @param {string} rkey - The unique route key of the page.
- @param {PageAction} action - The state mutation to apply.
- @returns {Promise<PageMutationResult>}
  \*/
  updatePageState: async (rkey, action) => {
  const isPublished = action === 'publish';


    // Unified database execution and error handling
    const result = await prisma.page.update({
      where: { rkey },
      data: { isPublished }
    });

    return {
      success: true,
      rkey: result.rkey,
      updatedAt: result.updatedAt
    };

},

/\*\*

- Updates page metadata.
-
- @param {string} rkey
- @param {Object} metadata
- @returns {Promise<PageMutationResult>}
  \*/
  updatePageMeta: async (rkey, metadata) => {
  // Implementation...
  }
  };
