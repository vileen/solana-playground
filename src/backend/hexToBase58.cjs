// Usage: node src/backend/hexToBase58.js <hexstring>
const bs58 = require('bs58');

if (process.argv.length !== 3) {
  console.error('Usage: node src/backend/hexToBase58.js <hexstring>');
  process.exit(1);
}

const hex = process.argv[2];
try {
  const base58 = bs58.encode(Buffer.from(hex, 'hex'));
  console.log(base58);
} catch (e) {
  console.error('Invalid hex string:', e.message);
  process.exit(1);
} 