import { writeFileSync } from 'node:fs';
import { toCss } from '../src/index.ts';

// Writes tokens.css next to package.json. Run after changing src/index.ts; a test fails if the
// committed file is out of date.
writeFileSync(new URL('../tokens.css', import.meta.url), toCss());
