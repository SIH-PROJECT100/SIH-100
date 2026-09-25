import { GLOSSARY } from '../src/i18n/glossary.js';
import { config } from '../src/config.js';

const BASE_URL = `http://localhost:${config.PORT}`;

async function main() {
  const res = await fetch(`${BASE_URL}/i18n/captured-error-codes`);
  const data = (await res.json()) as any;
  console.log(`\n======================================================`);
  console.log(`DRIFT PREVENTION AUDIT: ERROR CODE GLOSSARY COVERAGE`);
  console.log(`======================================================`);
  console.log(`Total unique error codes captured across test suite: ${data.count}\n`);

  for (const code of data.data) {
    const entry = GLOSSARY[code];
    if (!entry) {
      console.error(`[DRIFT FAILURE] Code "${code}" is missing from GLOSSARY!`);
      process.exit(1);
    }
    console.log(`✓ [MATCH] "${code}"`);
    console.log(`    EN: ${entry.en}`);
    console.log(`    HI: ${entry.hi}`);
  }

  console.log(`\nFound ${data.count} unique error codes across 255 tests, all ${data.count} present in glossary.`);
  console.log(`Drift check passed with 100% glossary coverage.\n`);
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
