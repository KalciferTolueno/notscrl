/**
 * Build Script: Packs all modules into a single zero-dependency standalone bundle
 * Allows NotSCRL to run flawlessly whether opened via file:/// or served via http://
 */

const fs = require('fs');
const path = require('path');

const files = [
  'js/zip.js',
  'js/assets.js',
  'js/objects.js',
  'js/canvas.js',
  'js/storage.js',
  'js/exporter.js',
  'js/preview.js',
  'js/cropper.js',
  'js/frame-adjuster.js',
  'js/templates.js',
  'js/studio.js',
  'js/app.js'
];

let bundleContent = `/**
 * NotSCRL Studio - Standalone Client Bundle
 * 100% Offline & Compatible with both file:/// and http://
 */
(function() {
'use strict';
`;

for (const file of files) {
  let code = fs.readFileSync(path.join(__dirname, file), 'utf8');

  // Strip import statements
  code = code.replace(/import\s+[^;]+;?\s*/g, '');

  // Strip 'export class' -> 'class'
  code = code.replace(/export\s+class\s+/g, 'class ');

  // Strip 'export const' -> 'const'
  code = code.replace(/export\s+const\s+/g, 'const ');

  // Strip 'export function' -> 'function'
  code = code.replace(/export\s+async\s+function\s+/g, 'async function ');
  code = code.replace(/export\s+function\s+/g, 'function ');

  bundleContent += `\n// ---- BEGIN ${file} ----\n` + code + `\n// ---- END ${file} ----\n`;
}

bundleContent += `\n})();\n`;

fs.writeFileSync(path.join(__dirname, 'js/notscrl.bundle.js'), bundleContent, 'utf8');
console.log('Successfully created js/notscrl.bundle.js!');
