// Heady liboqs Middleware Adapter
// Provides post-quantum crypto services alongside OpenSSL

const { execSync } = require('child_process');
const path = require('path');

class LibOQSAdapter {
  constructor() {
    this.opensslPath = path.join(__dirname, '../../dist/openssl-pq/bin/openssl');
    this.liboqsPath = path.join(__dirname, '../../dist/openssl-pq/lib/liboqs.a');
    this.supportedAlgorithms = this.detectSupportedAlgorithms();
  }

  detectSupportedAlgorithms() {
    try {
      const output = execSync(`"${this.opensslPath}" list -public-key-algorithms`).toString();
      const pqAlgorithms = [
        'kyber512', 'kyber768', 'kyber1024',
        'dilithium2', 'dilithium3', 'dilithium5'
      ].filter(alg => output.includes(alg));
      
      return {
        classic: ['rsa', 'ec', 'x25519'],
        pq: pqAlgorithms,
        hybrid: pqAlgorithms.map(pq => `x25519+${pq}`)
      };
    } catch (error) {
      throw new Error(`PQ algorithm detection failed: ${error.message}`);
    }
  }

  generateKeyPair(algorithm = 'x25519+kyber768') {
    const [classicAlg, pqAlg] = algorithm.split('+');
    
    // Generate hybrid key pair
    const command = `"${this.opensslPath}" genpkey \
      -algorithm ${classicAlg} \
      -pkeyopt pq_kem:${pqAlg} \
      -outform PEM`;
    
    try {
      const keyPair = execSync(command).toString();
      return {
        algorithm,
        privateKey: keyPair,
        publicKey: this.extractPublicKey(keyPair)
      };
    } catch (error) {
      throw new Error(`Key generation failed: ${error.message}`);
    }
  }

  extractPublicKey(privateKeyPem) {
    // Implementation to extract public key
    // ...
  }
}

module.exports = LibOQSAdapter;
