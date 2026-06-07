// env.js
// Must use var (not const/let) so variables are globally accessible to other scripts

var hostname = window.location.hostname;

var isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
// Netlify automatically adds "--" and "netlify.app" to branch deploy URLs
var isTest = hostname.includes('test--') || hostname.includes('staging--');

// Environment name — used by supabase-config.js to pick the right project
var ENV = isLocal ? 'local' : isTest ? 'test' : 'production';

// Site URLs per environment
var UPPSKRIFT_URL = isLocal
  ? 'http://localhost:8888'
  : isTest
    ? 'https://test--unrivaled-custard-b4af1f.netlify.app'
    : 'https://uppskriftir.franklin.is';

console.debug('[env] Running in:', ENV, '—', UPPSKRIFT_URL);