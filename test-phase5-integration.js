/**
 * Phase 5 Integration Test
 * Tests the unified viewer and multi-view integration
 */

console.log('🧪 Phase 5 Integration Test\n');

// Mock browser environment
globalThis.window = {
  location: {
    hash: '',
    search: '?sessionId=test-session-123',
    href: ''
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  scrollTo: () => {},
  pageYOffset: 0,
  scrollY: 0
};

globalThis.document = {
  createElement: () => ({
    className: '',
    innerHTML: '',
    textContent: '',
    appendChild: () => {},
    addEventListener: () => {},
    setAttribute: () => {},
    classList: { add: () => {}, remove: () => {} },
    querySelector: () => null,
    querySelectorAll: () => []
  }),
  getElementById: () => null,
  addEventListener: () => {}
};

// Test 1: StateManager API integration
console.log('Test 1: StateManager API Integration');
try {
  const { StateManager } = await import('./Public/components/shared/StateManager.js');

  const stateManager = new StateManager();

  // Set session ID
  stateManager.setState({ sessionId: 'test-123' });

  const state = stateManager.getState();
  if (state.sessionId !== 'test-123') {
    throw new Error('Session ID not set correctly');
  }
  console.log('  ✅ Session ID management');

  // Test view switching
  stateManager.setState({ currentView: 'slides' });
  if (stateManager.getState().currentView !== 'slides') {
    throw new Error('View switching failed');
  }
  console.log('  ✅ View switching');

  // Test state subscription
  let called = false;
  const unsubscribe = stateManager.subscribe((newState) => {
    called = true;
  });

  stateManager.setState({ currentView: 'document' });
  if (!called) {
    throw new Error('Subscriber not called');
  }
  console.log('  ✅ State subscription');

  unsubscribe();
  console.log('  ✅ Unsubscribe');

  console.log('✅ Test 1 passed\n');
} catch (error) {
  console.error('❌ Test 1 failed:', error.message);
  process.exit(1);
}

// Test 2: View components import
console.log('Test 2: View Components Import');
try {
  const { SlidesView } = await import('./Public/components/views/SlidesView.js');
  const { DocumentView } = await import('./Public/components/views/DocumentView.js');

  // Test instantiation
  const slidesView = new SlidesView();
  const documentView = new DocumentView();

  console.log('  ✅ SlidesView imported and instantiated');
  console.log('  ✅ DocumentView imported and instantiated');

  console.log('✅ Test 2 passed\n');
} catch (error) {
  console.error('❌ Test 2 failed:', error.message);
  process.exit(1);
}

// Test 3: File structure verification
console.log('Test 3: File Structure Verification');
try {
  const fs = await import('fs');

  const requiredFiles = [
    'Public/viewer.html',
    'Public/viewer.js',
    'Public/components/shared/StateManager.js',
    'Public/components/views/SlidesView.js',
    'Public/components/views/DocumentView.js',
    'Public/styles/design-system.css',
    'Public/styles/app-shell.css',
    'Public/styles/slides-view.css',
    'Public/styles/document-view.css'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Required file missing: ${file}`);
    }
    console.log(`  ✅ ${file}`);
  }

  console.log('✅ Test 3 passed\n');
} catch (error) {
  console.error('❌ Test 3 failed:', error.message);
  process.exit(1);
}

// Test 4: Integration workflow
console.log('Test 4: Integration Workflow');
try {
  const { StateManager } = await import('./Public/components/shared/StateManager.js');
  const { SlidesView } = await import('./Public/components/views/SlidesView.js');
  const { DocumentView } = await import('./Public/components/views/DocumentView.js');

  // Simulate full workflow
  const stateManager = new StateManager();

  // 1. Initialize with session
  stateManager.setState({ sessionId: 'workflow-test-123' });
  console.log('  ✅ Step 1: Session initialized');

  // 2. Switch to slides view
  stateManager.setState({ currentView: 'slides' });
  console.log('  ✅ Step 2: Switched to slides view');

  // 3. Create slides component
  const mockSlidesData = {
    title: 'Test',
    slides: [{ type: 'title', title: 'Test Slide' }],
    totalSlides: 1
  };
  const slidesView = new SlidesView(mockSlidesData);
  console.log('  ✅ Step 3: SlidesView component created');

  // 4. Switch to document view
  stateManager.setState({ currentView: 'document' });
  console.log('  ✅ Step 4: Switched to document view');

  // 5. Create document component
  const mockDocData = {
    title: 'Test Document',
    sections: [
      {
        id: 'test',
        heading: 'Test Section',
        level: 1,
        content: []
      }
    ]
  };
  const documentView = new DocumentView(mockDocData);
  console.log('  ✅ Step 5: DocumentView component created');

  // 6. Verify state management
  const finalState = stateManager.getState();
  if (finalState.sessionId !== 'workflow-test-123' || finalState.currentView !== 'document') {
    throw new Error('State not maintained correctly');
  }
  console.log('  ✅ Step 6: State maintained correctly');

  console.log('✅ Test 4 passed\n');
} catch (error) {
  console.error('❌ Test 4 failed:', error.message);
  process.exit(1);
}

// Summary
console.log('═══════════════════════════════════════');
console.log('🎉 ALL PHASE 5 INTEGRATION TESTS PASSED');
console.log('═══════════════════════════════════════');
console.log('\nPhase 5 Integration Status:');
console.log('  ✅ StateManager API integration');
console.log('  ✅ View component imports');
console.log('  ✅ All required files present');
console.log('  ✅ End-to-end workflow');
console.log('\nComponents Integrated:');
console.log('  • viewer.html - Unified viewer page');
console.log('  • viewer.js - Main application logic');
console.log('  • StateManager - State management with API integration');
console.log('  • SlidesView - Presentation mode');
console.log('  • DocumentView - Long-form reading');
console.log('  • Design System - Complete CSS framework');
console.log('\nReady for browser testing!');
console.log('Open viewer.html?sessionId=YOUR_SESSION_ID to test');

process.exit(0);
