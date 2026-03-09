const { ethers } = require('ethers');
const crypto = require('crypto');

// Pending auth challenges: walletAddress → { nonce, expiresAt }
const challenges = new Map();

const CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

// Clean expired challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [addr, c] of challenges) {
    if (now > c.expiresAt) challenges.delete(addr);
  }
}, 60_000);

/// Generate a challenge nonce for a wallet to sign
function createChallenge(walletAddress) {
  const addr = walletAddress.toLowerCase();
  const nonce = crypto.randomBytes(16).toString('hex');
  challenges.set(addr, { nonce, expiresAt: Date.now() + CHALLENGE_TTL });
  return nonce;
}

/// Verify a signed challenge — returns { valid, address } or { valid: false, error }
function verifySignature(walletAddress, signature) {
  const addr = walletAddress.toLowerCase();
  const challenge = challenges.get(addr);

  if (!challenge) {
    return { valid: false, error: 'No challenge found — request one first' };
  }

  if (Date.now() > challenge.expiresAt) {
    challenges.delete(addr);
    return { valid: false, error: 'Challenge expired — request a new one' };
  }

  const message = `PokerAI Login\nNonce: ${challenge.nonce}`;

  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== addr) {
      return { valid: false, error: 'Signature does not match wallet' };
    }

    // Challenge consumed — delete it
    challenges.delete(addr);
    return { valid: true, address: addr };
  } catch (e) {
    return { valid: false, error: 'Invalid signature format' };
  }
}

/// Build the message the client needs to sign
function getChallengeMessage(nonce) {
  return `PokerAI Login\nNonce: ${nonce}`;
}

module.exports = { createChallenge, verifySignature, getChallengeMessage };
