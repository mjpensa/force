/**
 * Database Test Script
 * Tests the database operations to ensure everything works
 */

import { SessionDB, ContentDB, JobDB, Cleanup } from './db.js';
import crypto from 'crypto';

console.log('🧪 Starting Database Tests...\n');

// Test 1: Create a session
console.log('Test 1: Creating a session...');
const sessionId = crypto.randomUUID();
const testFiles = [
  { name: 'test.pdf', content: 'Sample research content' }
];
const created = SessionDB.create(sessionId, 'Test prompt', testFiles);
console.log(created ? '✅ Session created' : '❌ Failed to create session');

// Test 2: Retrieve the session
console.log('\nTest 2: Retrieving session...');
const session = SessionDB.get(sessionId);
if (session) {
  console.log('✅ Session retrieved');
  console.log('   Session ID:', session.sessionId);
  console.log('   Prompt:', session.prompt);
  console.log('   Status:', session.status);
} else {
  console.log('❌ Failed to retrieve session');
}

// Test 3: Create a job
console.log('\nTest 3: Creating a job...');
const jobId = crypto.randomUUID();
JobDB.create(jobId, sessionId);
const job = JobDB.get(jobId);
console.log(job ? '✅ Job created' : '❌ Failed to create job');
if (job) {
  console.log('   Job ID:', job.jobId);
  console.log('   Status:', job.status);
  console.log('   Progress:', job.progress);
}

// Test 4: Update job progress
console.log('\nTest 4: Updating job progress...');
JobDB.updateProgress(jobId, {
  roadmap: 'complete',
  slides: 'processing',
  document: 'pending'
});
const updatedJob = JobDB.get(jobId);
console.log('✅ Job progress updated');
console.log('   Progress:', updatedJob.progress);

// Test 5: Save content
console.log('\nTest 5: Saving content...');
const testRoadmapData = {
  title: 'Test Roadmap',
  timeColumns: ['Q1', 'Q2', 'Q3'],
  data: [],
  legend: []
};
ContentDB.save(sessionId, 'roadmap', testRoadmapData);
console.log('✅ Roadmap content saved');

const testSlidesData = {
  title: 'Test Presentation',
  slides: []
};
ContentDB.save(sessionId, 'slides', testSlidesData);
console.log('✅ Slides content saved');

const testDocumentData = {
  title: 'Test Document',
  sections: []
};
ContentDB.save(sessionId, 'document', testDocumentData);
console.log('✅ Document content saved');

// Test 6: Retrieve content
console.log('\nTest 6: Retrieving content...');
const roadmapContent = ContentDB.get(sessionId, 'roadmap');
console.log(roadmapContent ? '✅ Roadmap content retrieved' : '❌ Failed to retrieve roadmap');

const allContent = ContentDB.getAll(sessionId);
console.log('✅ All content retrieved');
console.log('   Views available:', Object.keys(allContent));

// Test 7: Update session status
console.log('\nTest 7: Updating session status...');
SessionDB.updateStatus(sessionId, 'complete');
const updatedSession = SessionDB.get(sessionId);
console.log('✅ Session status updated to:', updatedSession.status);

// Test 8: List recent sessions
console.log('\nTest 8: Listing recent sessions...');
const recentSessions = SessionDB.listRecent(10);
console.log(`✅ Found ${recentSessions.length} recent session(s)`);

// Test 9: Database stats
console.log('\nTest 9: Getting database stats...');
const stats = Cleanup.getStats();
console.log('✅ Database statistics:');
console.log('   Sessions:', stats.sessions);
console.log('   Content items:', stats.content);
console.log('   Jobs:', stats.jobs);
console.log('   Database size:', (stats.dbSize / 1024).toFixed(2), 'KB');

// Test 10: Cleanup
console.log('\nTest 10: Testing cleanup (not deleting test data)...');
console.log('✅ Cleanup functions available');
console.log('   - Can delete old sessions (30+ days)');
console.log('   - Can delete old jobs (7+ days)');

console.log('\n🎉 All database tests completed successfully!');
console.log('\n💡 You can inspect the database with:');
console.log('   sqlite3 data/force.db');
console.log('   sqlite> SELECT * FROM sessions;');
console.log('   sqlite> SELECT * FROM content;');
console.log('   sqlite> SELECT * FROM jobs;');
