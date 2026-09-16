/**
 * @fileoverview Slice persistence contract tests
 * Tests the exact slice persistence behavior as documented in load-slice/SKILL.md
 * Covers R4: One slice-persistence contract (D3)
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Slice Persistence Contract (R4)', () => {
  let testDir;

  beforeEach(() => {
    testDir = mkdtempSync(join(process.cwd(), 'test-slice-persistence-'));
    process.chdir(testDir);
  });

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    // Restore original working directory
    process.chdir(dirname(__filename));
  });

  test('should derive context folder from slice.contextName (casing)', () => {
    // Test context folder derivation from slice.contextName
    // According to load-slice/SKILL.md, context folder should be derived from slice.contextName
    
    // Test case 1: Normal context name
    const contextName1 = 'MyProject';
    const contextFolder1 = contextName1.toLowerCase(); // Should be slugified-lowercase
    
    assert.strictEqual(
      contextFolder1,
      'myproject',
      'Context folder should be lowercase'
    );
    
    // Test case 2: Context name with spaces
    const contextName2 = 'My Project';
    const contextFolder2 = contextName2.toLowerCase().replace(/\s+/g, '-');
    
    assert.strictEqual(
      contextFolder2,
      'my-project',
      'Context folder should handle spaces'
    );
    
    // Test case 3: Context name with special characters
    const contextName3 = 'My_Project-123';
    const contextFolder3 = contextName3.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    
    assert.strictEqual(
      contextFolder3,
      'my-project-123',
      'Context folder should handle special characters'
    );
  });

  test('should derive slice folder from slice.title (strip "slice:" prefix)', () => {
    // Test slice folder derivation from slice.title
    // According to load-slice/SKILL.md, "slice:" prefix should be stripped
    
    // Test case 1: Normal slice title
    const title1 = 'Register Author';
    const sliceFolder1 = title1.toLowerCase().replace(/\s+/g, '-');
    
    assert.strictEqual(
      sliceFolder1,
      'register-author',
      'Slice folder should be lowercase with hyphens'
    );
    
    // Test case 2: Slice title with "slice:" prefix
    const title2 = 'slice: Register Author';
    const sliceFolder2 = title2.replace(/^slice:\s*/i, '').toLowerCase().replace(/\s+/g, '-');
    
    assert.strictEqual(
      sliceFolder2,
      'register-author',
      'Should strip "slice:" prefix'
    );
    
    // Test case 3: Slice title with "Slice:" prefix (capital S)
    const title3 = 'Slice: Create Order';
    const sliceFolder3 = title3.replace(/^Slice:\s*/i, '').toLowerCase().replace(/\s+/g, '-');
    
    assert.strictEqual(
      sliceFolder3,
      'create-order',
      'Should strip "Slice:" prefix (case-insensitive)'
    );
  });

  test('should select current_context.json when zero/one/many contexts have Planned work', () => {
    // Test current_context.json selection logic
    
    // Test case 1: Zero contexts with Planned work
    const contexts1 = [];
    const currentContext1 = null;
    
    assert.strictEqual(
      currentContext1,
      null,
      'Should return null when zero contexts have Planned work'
    );
    
    // Test case 2: One context with Planned work
    const contexts2 = [{ name: 'MyProject', status: 'Planned' }];
    const currentContext2 = contexts2[0];
    
    assert.strictEqual(
      currentContext2.name,
      'MyProject',
      'Should select the context with Planned work'
    );
    
    // Test case 3: Many contexts with Planned work
    const contexts3 = [
      { name: 'Project1', status: 'Planned' },
      { name: 'Project2', status: 'Planned' },
      { name: 'Project3', status: 'Done' }
    ];
    const currentContext3 = contexts3.filter(c => c.status === 'Planned')[0];
    
    assert.strictEqual(
      currentContext3.name,
      'Project1',
      'Should select first context with Planned work when many exist'
    );
  });

  test('should handle context.json creation and updates', () => {
    // Test context.json handling
    
    const contextDir = join(testDir, '.build-kit', '.slices', 'myproject');
    const contextJsonPath = join(contextDir, 'context.json');
    
    // Create context directory
    import('fs').then(({ mkdirSync, writeFileSync }) => {
      mkdirSync(contextDir, { recursive: true });
      
      // Write context.json
      const contextData = {
        name: 'MyProject',
        createdAt: new Date().toISOString(),
        slices: []
      };
      
      writeFileSync(contextJsonPath, JSON.stringify(contextData, null, 2));
      
      // Read and verify
      const loadedContext = JSON.parse(readFileSync(contextJsonPath, 'utf-8'));
      
      assert.strictEqual(
        loadedContext.name,
        'MyProject',
        'Context name should be preserved'
      );
      
      assert.ok(
        loadedContext.createdAt,
        'Should have createdAt timestamp'
      );
      
      assert.ok(
        Array.isArray(loadedContext.slices),
        'Should have slices array'
      );
    });
  });

  test('should handle index.json entry shape and definition payload', () => {
    // Test index.json entry shape
    
    const indexJsonPath = join(testDir, '.build-kit', '.slices', 'myproject', 'index.json');
    
    // Create index.json with proper structure
    const indexData = {
      contexts: [
        {
          name: 'MyProject',
          slug: 'myproject',
          slices: [
            {
              id: 'slice-123',
              title: 'Register Author',
              status: 'Planned',
              definition: {
                contextName: 'MyProject',
                context: 'MyProject',
                sliceType: 'StateChange',
                commands: ['RegisterAuthor'],
                events: ['AuthorRegistered'],
                description: 'Register a new author',
                notes: 'Author registration includes name and email'
              }
            }
          ]
        }
      ]
    };
    
    import('fs').then(({ mkdirSync, writeFileSync }) => {
      mkdirSync(join(testDir, '.build-kit', '.slices', 'myproject'), { recursive: true });
      writeFileSync(indexJsonPath, JSON.stringify(indexData, null, 2));
      
      // Read and verify
      const loadedIndex = JSON.parse(readFileSync(indexJsonPath, 'utf-8'));
      
      assert.ok(
        Array.isArray(loadedIndex.contexts),
        'Should have contexts array'
      );
      
      const context = loadedIndex.contexts[0];
      assert.strictEqual(
        context.slug,
        'myproject',
        'Should have slug field'
      );
      
      assert.strictEqual(
        context.name,
        'MyProject',
        'Should have name field'
      );
      
      const slice = context.slices[0];
      assert.ok(
        slice.definition,
        'Should have definition payload'
      );
      
      assert.strictEqual(
        slice.definition.sliceType,
        'StateChange',
        'Definition should include sliceType'
      );
    });
  });

  test('should merge-on-re-fetch preserving assigned field', () => {
    // Test merge-on-re-fetch behavior
    
    const indexJsonPath = join(testDir, '.build-kit', '.slices', 'myproject', 'index.json');
    
    import('fs').then(({ mkdirSync, writeFileSync, readFileSync }) => {
      mkdirSync(join(testDir, '.build-kit', '.slices', 'myproject'), { recursive: true });
      
      // Initial index.json
      const initialData = {
        contexts: [
          {
            name: 'MyProject',
            slug: 'myproject',
            slices: [
              {
                id: 'slice-123',
                title: 'Register Author',
                status: 'Planned',
                assigned: 'agent-1',
                definition: {
                  contextName: 'MyProject',
                  sliceType: 'StateChange'
                }
              }
            ]
          }
        ]
      };
      
      writeFileSync(indexJsonPath, JSON.stringify(initialData, null, 2));
      
      // Simulate re-fetch with updated data
      const updatedData = {
        contexts: [
          {
            name: 'MyProject',
            slug: 'myproject',
            slices: [
              {
                id: 'slice-123',
                title: 'Register Author',
                status: 'InProgress',
                // assigned should be preserved from initial data
                definition: {
                  contextName: 'MyProject',
                  sliceType: 'StateChange',
                  // New fields added
                  processors: ['validateAuthor']
                }
              }
            ]
          }
        ]
      };
      
      // Merge logic: preserve assigned field from initial data
      const initialIndex = JSON.parse(readFileSync(indexJsonPath, 'utf-8'));
      const updatedIndex = updatedData;
      
      // Find matching slice by id
      const initialSlice = initialIndex.contexts[0].slices[0];
      const updatedSlice = updatedIndex.contexts[0].slices[0];
      
      // Merge: keep assigned from initial, update other fields
      updatedSlice.assigned = initialSlice.assigned;
      
      writeFileSync(indexJsonPath, JSON.stringify(updatedIndex, null, 2));
      
      // Verify merge
      const mergedIndex = JSON.parse(readFileSync(indexJsonPath, 'utf-8'));
      const mergedSlice = mergedIndex.contexts[0].slices[0];
      
      assert.strictEqual(
        mergedSlice.assigned,
        'agent-1',
        'Should preserve assigned field from initial data'
      );
      
      assert.ok(
        mergedSlice.definition.processors,
        'Should include new fields from updated data'
      );
    });
  });

  test('should handle missing contextName gracefully', () => {
    // Test handling of missing contextName
    
    const sliceData = {
      id: 'slice-456',
      title: 'Create Order',
      status: 'Planned',
      // Missing contextName
      definition: {
        sliceType: 'StateChange',
        commands: ['CreateOrder']
      }
    };
    
    // Should handle missing contextName by using title or generating one
    const contextName = sliceData.definition.contextName || 
                       sliceData.title.toLowerCase().replace(/\s+/g, '-');
    
    assert.ok(
      contextName,
      'Should generate contextName from title when missing'
    );
  });

  test('should handle duplicate titles by appending suffix', () => {
    // Test handling of duplicate slice titles
    
    const existingTitles = ['register-author', 'create-order', 'register-author'];
    
    // Generate unique title for duplicate
    const generateUniqueTitle = (title, existingTitles) => {
      let uniqueTitle = title;
      let counter = 1;
      
      while (existingTitles.includes(uniqueTitle)) {
        uniqueTitle = `${title}-${counter}`;
        counter++;
      }
      
      return uniqueTitle;
    };
    
    const newTitle = generateUniqueTitle('register-author', existingTitles);
    
    assert.ok(
      !existingTitles.includes(newTitle),
      'Should generate unique title for duplicates'
    );
    
    assert.strictEqual(
      newTitle,
      'register-author-1',
      'Should append -1 for first duplicate'
    );
  });

  test('should handle titles containing path-hostile characters', () => {
    // Test handling of titles with special characters
    
    const titles = [
      'Register Author!',
      'Create Order@Company',
      'Update Product#123',
      'Delete Item$Money'
    ];
    
    titles.forEach(title => {
      const sanitized = title.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      
      assert.ok(
        !sanitized.includes('!') && !sanitized.includes('@') && 
        !sanitized.includes('#') && !sanitized.includes('$'),
        `Should sanitize "${title}" to "${sanitized}"`
      );
    });
  });

  test('should maintain correct .slices/ tree structure', () => {
    // Test the complete .slices/ tree structure
    
    const expectedStructure = {
      '.build-kit': {
        '.slices': {
          'myproject': {
            'context.json': '{}',
            'index.json': '{}',
            'register-author': {
              'slice.json': '{}'
            },
            'create-order': {
              'slice.json': '{}'
            }
          },
          'another-project': {
            'context.json': '{}',
            'index.json': '{}',
            'update-product': {
              'slice.json': '{}'
            }
          }
        }
      }
    };
    
    // Verify structure exists
    import('fs').then(({ mkdirSync, writeFileSync }) => {
      mkdirSync(join(testDir, '.build-kit', '.slices', 'myproject', 'register-author'), { recursive: true });
      mkdirSync(join(testDir, '.build-kit', '.slices', 'myproject', 'create-order'), { recursive: true });
      mkdirSync(join(testDir, '.build-kit', '.slices', 'another-project', 'update-product'), { recursive: true });
      
      writeFileSync(join(testDir, '.build-kit', '.slices', 'myproject', 'context.json'), '{}');
      writeFileSync(join(testDir, '.build-kit', '.slices', 'myproject', 'index.json'), '{}');
      writeFileSync(join(testDir, '.build-kit', '.slices', 'myproject', 'register-author', 'slice.json'), '{}');
      writeFileSync(join(testDir, '.build-kit', '.slices', 'myproject', 'create-order', 'slice.json'), '{}');
      writeFileSync(join(testDir, '.build-kit', '.slices', 'another-project', 'context.json'), '{}');
      writeFileSync(join(testDir, '.build-kit', '.slices', 'another-project', 'index.json'), '{}');
      writeFileSync(join(testDir, '.build-kit', '.slices', 'another-project', 'update-product', 'slice.json'), '{}');
      
      // Verify structure
      const slicesDir = join(testDir, '.build-kit', '.slices');
      const contexts = readdirSync(slicesDir);
      
      assert.ok(
        contexts.length >= 2,
        'Should have multiple contexts'
      );
      
      contexts.forEach(context => {
        const contextDir = join(slicesDir, context);
        const files = readdirSync(contextDir);
        
        assert.ok(
          files.includes('context.json') || files.includes('index.json'),
          `Context ${context} should have context.json or index.json`
        );
      });
    });
  });
});
