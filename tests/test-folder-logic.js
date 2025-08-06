/**
 * Comprehensive test suite for folder auto-close behavior
 * Tests the core logic functions without requiring DOM manipulation
 */

// Mock DOM and global objects for testing
const mockDOM = {
    elements: new Map(),
    querySelectorAll: function(selector) {
        const results = [];
        for (let [id, element] of this.elements) {
            if (selector.includes(element.className) || (element.dataset && selector.includes(element.dataset.folderId))) {
                results.push(element);
            }
        }
        return results;
    },
    querySelector: function(selector) {
        for (let [id, element] of this.elements) {
            if ((element.dataset && selector.includes(element.dataset.folderId)) || selector.includes(id)) {
                return element;
            }
        }
        return null;
    },
    getElementById: function(id) {
        return this.elements.get(id) || null;
    },
    createElement: function(tag) {
        return {
            tagName: tag,
            classList: {
                classes: new Set(),
                add: function(className) {
                    this.classes.add(className);
                },
                remove: function(className) {
                    this.classes.delete(className);
                },
                contains: function(className) {
                    return this.classes.has(className);
                }
            },
            dataset: {},
            textContent: '',
            setAttribute: function(name, value) {
                this.dataset[name] = value;
            }
        };
    }
};

// Mock global objects
global.document = mockDOM;
global.console = console;

// Test data setup
let testBookmarkData = {
    folders: [
        // Root level folders
        {
            id: 'folder1',
            name: 'Empty Folder 1',
            parentId: null,
            order: 1
        },
        {
            id: 'folder2',
            name: 'Empty Folder 2',
            parentId: null,
            order: 2
        },
        {
            id: 'folder3',
            name: 'Parent Folder 1',
            parentId: null,
            order: 3
        },
        {
            id: 'folder4',
            name: 'Parent Folder 2',
            parentId: null,
            order: 4
        },
        {
            id: 'folder5',
            name: 'Empty Folder 3',
            parentId: null,
            order: 5
        },

        // Subfolders
        {
            id: 'subfolder1',
            name: 'Subfolder 1.1',
            parentId: 'folder3',
            order: 1
        },
        {
            id: 'subfolder2',
            name: 'Subfolder 1.2',
            parentId: 'folder3',
            order: 2
        },
        {
            id: 'subfolder3',
            name: 'Subfolder 2.1',
            parentId: 'folder4',
            order: 1
        },

        // Nested subfolders
        {
            id: 'nested1',
            name: 'Nested 1.1.1',
            parentId: 'subfolder1',
            order: 1
        }
    ],
    links: [],
    notes: {
        content: '<p></p>',
        plainContent: '',
        position: {
            x: 50,
            y: 100
        },
        size: {
            width: 300,
            height: 400
        },
        formatVersion: '1.0'
    }
};

// Extract the core functions from main.js for testing
function hasSubfolders(folderId) {
    return testBookmarkData.folders.some(folder => folder.parentId === folderId);
}

function createMockFolderElement(folderId, expanded = false) {
    const element = {
        classList: {
            classes: new Set(expanded ? ['folder', 'expanded'] : ['folder']),
            add: function(className) {
                this.classes.add(className);
            },
            remove: function(className) {
                this.classes.delete(className);
            },
            contains: function(className) {
                return this.classes.has(className);
            }
        },
        dataset: {
            folderId: folderId
        },
        getAttribute: function(name) {
            return this.dataset[name];
        }
    };

    mockDOM.elements.set(`folder-${folderId}`, element);

    // Create mock icon element
    const icon = {
        textContent: expanded ? '📂' : '📁',
        classList: {
            classes: new Set(expanded ? ['open'] : []),
            add: function(className) {
                this.classes.add(className);
            },
            remove: function(className) {
                this.classes.delete(className);
            },
            contains: function(className) {
                return this.classes.has(className);
            }
        }
    };

    mockDOM.elements.set(`folder-icon-${folderId}`, icon);

    return element;
}

function autoCloseEmptyFolders(currentFolderId) {
    // Get all currently expanded folders
    const expandedFolders = [];
    for (let [id, element] of mockDOM.elements) {
        if (id.startsWith('folder-') && !id.includes('icon') && element.classList.contains('expanded')) {
            expandedFolders.push(element);
        }
    }

    expandedFolders.forEach(folderElement => {
        const folderId = folderElement.getAttribute('data-folder-id') || folderElement.dataset.folderId;

        // Skip the current folder being clicked
        if (folderId === currentFolderId) {
            return;
        }

        // Check if this folder has subfolders
        if (!hasSubfolders(folderId)) {
            // Close the folder by removing expanded class and updating icon
            folderElement.classList.remove('expanded');

            const folderIcon = mockDOM.getElementById(`folder-icon-${folderId}`);
            if (folderIcon) {
                folderIcon.textContent = '📁';
                folderIcon.classList.remove('open');
            }
        }
    });
}

// Test suite
class TestSuite {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    test(name, testFunction) {
        this.tests.push({
            name,
            testFunction
        });
    }

    run() {
        console.log('🧪 Running Folder Auto-Close Behavior Tests\n');

        for (let test of this.tests) {
            try {
                const result = test.testFunction();
                this.results.push({
                    name: test.name,
                    passed: result.passed,
                    message: result.message
                });
                console.log(`${result.passed ? '✅' : '❌'} ${test.name}: ${result.message}`);
            } catch (error) {
                this.results.push({
                    name: test.name,
                    passed: false,
                    message: `Error: ${error.message}`
                });
                console.log(`❌ ${test.name}: Error: ${error.message}`);
            }
        }

        this.printSummary();
    }

    printSummary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = total - passed;

        console.log('\n📊 Test Summary:');
        console.log(`Total: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.filter(r => !r.passed).forEach(r => {
                console.log(`  - ${r.name}: ${r.message}`);
            });
        }
    }
}

// Initialize test suite
const suite = new TestSuite();

// Test 1: hasSubfolders function
suite.test('hasSubfolders - Empty Folder', () => {
    const result = hasSubfolders('folder1');
    return {
        passed: result === false,
        message: result === false ? 'Correctly identifies empty folder' : `Expected false, got ${result}`
    };
});

suite.test('hasSubfolders - Folder with Subfolders', () => {
    const result = hasSubfolders('folder3');
    return {
        passed: result === true,
        message: result === true ? 'Correctly identifies folder with subfolders' : `Expected true, got ${result}`
    };
});

suite.test('hasSubfolders - Non-existent Folder', () => {
    const result = hasSubfolders('nonexistent');
    return {
        passed: result === false,
        message: result === false ? 'Correctly handles non-existent folder' : `Expected false, got ${result}`
    };
});

suite.test('hasSubfolders - Nested Subfolder', () => {
    const result = hasSubfolders('subfolder1');
    return {
        passed: result === true,
        message: result === true ? 'Correctly identifies nested subfolder with children' : `Expected true, got ${result}`
    };
});

// Test 2: autoCloseEmptyFolders function
suite.test('autoCloseEmptyFolders - Close Empty Folders', () => {
    // Setup: Create expanded empty folders
    mockDOM.elements.clear();
    createMockFolderElement('folder1', true); // Empty, should close
    createMockFolderElement('folder2', true); // Empty, should close
    createMockFolderElement('folder3', true); // Has subfolders, should stay open

    // Run auto-close for folder4 (current folder)
    autoCloseEmptyFolders('folder4');

    const folder1 = mockDOM.elements.get('folder-folder1');
    const folder2 = mockDOM.elements.get('folder-folder2');
    const folder3 = mockDOM.elements.get('folder-folder3');

    const folder1Closed = !folder1.classList.contains('expanded');
    const folder2Closed = !folder2.classList.contains('expanded');
    const folder3Open = folder3.classList.contains('expanded');

    return {
        passed: folder1Closed && folder2Closed && folder3Open,
        message: folder1Closed && folder2Closed && folder3Open ?
            'Empty folders closed, folder with subfolders stayed open' : `folder1 closed: ${folder1Closed}, folder2 closed: ${folder2Closed}, folder3 open: ${folder3Open}`
    };
});

suite.test('autoCloseEmptyFolders - Skip Current Folder', () => {
    // Setup: Create expanded empty folder
    mockDOM.elements.clear();
    createMockFolderElement('folder1', true); // Empty but current, should not close

    // Run auto-close for folder1 (current folder)
    autoCloseEmptyFolders('folder1');

    const folder1 = mockDOM.elements.get('folder-folder1');
    const folder1Open = folder1.classList.contains('expanded');

    return {
        passed: folder1Open,
        message: folder1Open ?
            'Current folder correctly skipped from auto-close' : 'Current folder was incorrectly closed'
    };
});

suite.test('autoCloseEmptyFolders - Icon Updates', () => {
    // Setup: Create expanded empty folder
    mockDOM.elements.clear();
    createMockFolderElement('folder1', true); // Empty, should close

    const iconBefore = mockDOM.elements.get('folder-icon-folder1');
    const iconBeforeText = iconBefore.textContent;
    const iconBeforeClass = iconBefore.classList.contains('open');

    // Run auto-close for folder2 (current folder)
    autoCloseEmptyFolders('folder2');

    const iconAfter = mockDOM.elements.get('folder-icon-folder1');
    const iconAfterText = iconAfter.textContent;
    const iconAfterClass = iconAfter.classList.contains('open');

    return {
        passed: iconBeforeText === '📂' && iconBeforeClass && iconAfterText === '📁' && !iconAfterClass,
        message: (iconBeforeText === '📂' && iconBeforeClass && iconAfterText === '📁' && !iconAfterClass) ?
            'Folder icon correctly updated from open to closed' : `Before: ${iconBeforeText} (open: ${iconBeforeClass}), After: ${iconAfterText} (open: ${iconAfterClass})`
    };
});

// Test 3: Edge cases
suite.test('autoCloseEmptyFolders - No Expanded Folders', () => {
    // Setup: No expanded folders
    mockDOM.elements.clear();
    createMockFolderElement('folder1', false);
    createMockFolderElement('folder2', false);

    try {
        autoCloseEmptyFolders('folder3');
        return {
            passed: true,
            message: 'Handles case with no expanded folders gracefully'
        };
    } catch (error) {
        return {
            passed: false,
            message: `Threw error with no expanded folders: ${error.message}`
        };
    }
});

suite.test('autoCloseEmptyFolders - Empty Folder Data', () => {
    // Temporarily empty folder data
    const originalFolders = testBookmarkData.folders;
    testBookmarkData.folders = [];

    mockDOM.elements.clear();
    createMockFolderElement('folder1', true);

    try {
        autoCloseEmptyFolders('folder2');

        // Restore data
        testBookmarkData.folders = originalFolders;

        return {
            passed: true,
            message: 'Handles empty folder data gracefully'
        };
    } catch (error) {
        // Restore data
        testBookmarkData.folders = originalFolders;

        return {
            passed: false,
            message: `Threw error with empty folder data: ${error.message}`
        };
    }
});

// Test 4: Complex scenarios
suite.test('Complex Scenario - Mixed Folder Types', () => {
    // Setup: Mix of empty folders and folders with subfolders
    mockDOM.elements.clear();
    createMockFolderElement('folder1', true); // Empty, should close
    createMockFolderElement('folder3', true); // Has subfolders, should stay open
    createMockFolderElement('folder4', true); // Has subfolders, should stay open
    createMockFolderElement('folder5', true); // Empty, should close

    autoCloseEmptyFolders('folder2');

    const folder1Closed = !mockDOM.elements.get('folder-folder1').classList.contains('expanded');
    const folder3Open = mockDOM.elements.get('folder-folder3').classList.contains('expanded');
    const folder4Open = mockDOM.elements.get('folder-folder4').classList.contains('expanded');
    const folder5Closed = !mockDOM.elements.get('folder-folder5').classList.contains('expanded');

    return {
        passed: folder1Closed && folder3Open && folder4Open && folder5Closed,
        message: (folder1Closed && folder3Open && folder4Open && folder5Closed) ?
            'Complex scenario handled correctly - empty folders closed, parent folders stayed open' : `Results: folder1 closed: ${folder1Closed}, folder3 open: ${folder3Open}, folder4 open: ${folder4Open}, folder5 closed: ${folder5Closed}`
    };
});

// Test 5: Requirements validation
suite.test('Requirement 1.1 - Empty Folder Auto-Close', () => {
    mockDOM.elements.clear();
    createMockFolderElement('folder1', true); // Empty folder, expanded

    autoCloseEmptyFolders('folder2'); // Click different folder

    const folder1Closed = !mockDOM.elements.get('folder-folder1').classList.contains('expanded');
    const iconClosed = mockDOM.elements.get('folder-icon-folder1').textContent === '📁';

    return {
        passed: folder1Closed && iconClosed,
        message: (folder1Closed && iconClosed) ?
            'Requirement 1.1 satisfied: Empty folder auto-closes when another folder is clicked' : 'Requirement 1.1 failed: Empty folder did not auto-close properly'
    };
});

suite.test('Requirement 2.1 - Folders with Subfolders Stay Open', () => {
    mockDOM.elements.clear();
    createMockFolderElement('folder3', true); // Folder with subfolders, expanded

    autoCloseEmptyFolders('folder1'); // Click different folder

    const folder3Open = mockDOM.elements.get('folder-folder3').classList.contains('expanded');
    const iconOpen = mockDOM.elements.get('folder-icon-folder3').textContent === '📂';

    return {
        passed: folder3Open && iconOpen,
        message: (folder3Open && iconOpen) ?
            'Requirement 2.1 satisfied: Folder with subfolders stays open when another folder is clicked' : 'Requirement 2.1 failed: Folder with subfolders incorrectly closed'
    };
});

// Run all tests
suite.run();

// Export for potential use in other test frameworks
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        hasSubfolders,
        autoCloseEmptyFolders,
        TestSuite,
        testBookmarkData
    };
}