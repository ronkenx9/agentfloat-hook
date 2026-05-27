import { encrypt } from './crypto';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: npx ts-node src/encrypt-key.ts <plaintextPrivateKey> <password>');
  process.exit(1);
}

const [plaintextKey, password] = args;
try {
  const formattedKey = plaintextKey.startsWith('0x') ? plaintextKey : `0x${plaintextKey}`;
  const encrypted = encrypt(formattedKey, password);
  console.log('\n--- Encryption Successful ---');
  console.log('Encrypted Private Key:');
  console.log(encrypted);
  console.log('------------------------------');
  console.log('Add the following to your .env file:');
  console.log(`PROMOTER_PRIVATE_KEY=${encrypted}`);
  console.log(`DECRYPTION_PASSWORD=${password}`);
  console.log('------------------------------\n');
} catch (error) {
  console.error('Encryption failed:', (error as Error).message);
  process.exit(1);
}
