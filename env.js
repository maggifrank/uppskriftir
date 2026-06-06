// env.js

const hostname = window.location.hostname;

// 1. Define our environments
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
// Netlify automatically adds "--" and "netlify.app" to branch deploy URLs
const isTest = hostname.includes('test--') || hostname.includes('staging--'); 

// 2. Route the URLs based on the environment
let UPPSKRIFT_URL;

if (isLocal) {
    // --- LOCAL DEV ---
    UPPSKRIFT_URL = 'http://localhost:8888';
} else if (isTest) {
    // --- TEST / STAGING ---
    UPPSKRIFT_URL = 'https://test--unrivaled-custard-b4af1f.netlify.app';
} else {
    // --- LIVE PRODUCTION ---
    UPPSKRIFT_URL = 'https://uppskriftir.franklin.is';
}