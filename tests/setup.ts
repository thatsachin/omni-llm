import * as fc from 'fast-check';

// Configure fast-check globally for all property tests
fc.configureGlobal({
  numRuns: 100, // Minimum 100 iterations per property
  verbose: false
});
