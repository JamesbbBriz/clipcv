// Pure-Node CRX3 packer. No third-party deps — uses node:crypto + node:fs.
//
// CRX3 wire format:
//   "Cr24"                                 (magic, 4 bytes)
//   uint32 LE                              (format version = 3)
//   uint32 LE                              (header length)
//   bytes                                  (CrxFileHeader proto)
//   bytes                                  (zip payload)
//
// Signed payload:
//   "CRX3 SignedData\x00"                  (16 bytes)
//   uint32 LE                              (length of signed_header_data)
//   bytes                                  (signed_header_data == SignedData proto)
//   bytes                                  (zip payload)
//
// Signature: RSASSA-PKCS1-v1_5 + SHA-256.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
} from 'node:crypto';

function varint(n) {
  const out = [];
  let v = n;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
  return Buffer.from(out);
}

function lenDelim(fieldNumber, payload) {
  const tag = varint((fieldNumber << 3) | 2);
  const len = varint(payload.length);
  return Buffer.concat([tag, len, payload]);
}

function loadOrGenerateKey(pemPath) {
  if (process.env.CRX_PRIVATE_KEY) {
    return { pem: process.env.CRX_PRIVATE_KEY, source: 'env' };
  }
  if (existsSync(pemPath)) {
    return { pem: readFileSync(pemPath, 'utf8'), source: `file:${pemPath}` };
  }
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  writeFileSync(pemPath, pem, { mode: 0o600 });
  return { pem, source: `generated:${pemPath}` };
}

function packCrx(zipPath, pemPath, outPath) {
  const { pem, source } = loadOrGenerateKey(pemPath);
  const privKey = createPrivateKey(pem);
  const pubKey = createPublicKey(privKey);
  const spkiDer = pubKey.export({ type: 'spki', format: 'der' });

  const crxId = createHash('sha256').update(spkiDer).digest().subarray(0, 16);
  const signedHeaderData = lenDelim(1, crxId);

  const zip = readFileSync(zipPath);
  const lenLE = Buffer.alloc(4);
  lenLE.writeUInt32LE(signedHeaderData.length, 0);
  const signPayload = Buffer.concat([
    Buffer.from('CRX3 SignedData\x00', 'utf8'),
    lenLE,
    signedHeaderData,
    zip,
  ]);
  const signature = sign('sha256', signPayload, privKey);

  const akp = Buffer.concat([
    lenDelim(1, spkiDer),
    lenDelim(2, signature),
  ]);
  const header = Buffer.concat([
    lenDelim(2, akp),
    lenDelim(10000, signedHeaderData),
  ]);

  const versionLE = Buffer.alloc(4);
  versionLE.writeUInt32LE(3, 0);
  const headerLenLE = Buffer.alloc(4);
  headerLenLE.writeUInt32LE(header.length, 0);
  const crx = Buffer.concat([
    Buffer.from('Cr24', 'utf8'),
    versionLE,
    headerLenLE,
    header,
    zip,
  ]);
  writeFileSync(outPath, crx);
  return { bytes: crx.length, crxId: crxId.toString('hex'), keySource: source };
}

const [, , zipPath, pemPath, outPath] = process.argv;
if (!zipPath || !pemPath || !outPath) {
  console.error('usage: pack-crx.mjs <zip> <pem> <out-crx>');
  process.exit(2);
}
const result = packCrx(zipPath, pemPath, outPath);
console.error(
  `wrote ${outPath} (${result.bytes} bytes; crx_id=${result.crxId}; key=${result.keySource})`,
);
