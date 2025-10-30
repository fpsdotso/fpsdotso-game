
const { PublicKey } = require('@solana/web3.js');
const programId = new PublicKey('4pfYuQkFmGXPFMjBNmYUstnC3jjgjxcBS8rSk8qcUUnE');
const gamePlayer = new PublicKey('6hA6FEgnWaaCeSDNvbvmmKQJw65eHtShJp7Nj3RCYQJc')
const ephemeralKey = new PublicKey('9VbC61VkavRrZq2PXfSVPhpqZb8TES2oTCsPZcqdRHwB');
const gameId = new PublicKey('4aa2JNGGTgrfJVPVidHTdMAUYibvWmpMh5JRAXaDhHgS');

const [pda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from('buffer'), gamePlayer.toBuffer()],
  programId
);
console.log('GamePlayer PDA:', pda.toString());
console.log('Bump:', bump);
