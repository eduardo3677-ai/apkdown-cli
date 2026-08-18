import crypto from 'crypto';
import fs from 'fs';

/**
 * Calculates hash of a file using streams for low memory footprint
 */
export async function calculateFileHash(
  filePath: string,
  algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Verifies file checksum against expected hash
 */
export async function verifyFileChecksum(
  filePath: string,
  expectedHash: string,
  algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'
): Promise<boolean> {
  if (!expectedHash) return true;
  const actualHash = await calculateFileHash(filePath, algorithm);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}
