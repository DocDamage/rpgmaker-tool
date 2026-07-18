/* Hybrid Tile Studio v18.1 — canonical SHA-256 and signature helpers */
(() => {
  "use strict";

  const VERSION = "18.1.0";
  const CANONICALIZATION_VERSION = 1;
  const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      const result = {};
      for (const key of Object.keys(value).sort()) {
        const next = value[key];
        if (next !== undefined) result[key] = canonicalize(next);
      }
      return result;
    }
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    return value;
  }

  function canonicalText(value) {
    return typeof value === "string" ? value : JSON.stringify(canonicalize(value));
  }

  function utf8Bytes(text) {
    if (encoder) return encoder.encode(String(text));
    const encoded = unescape(encodeURIComponent(String(text)));
    return Uint8Array.from(encoded, character => character.charCodeAt(0));
  }

  // Small, dependency-free SHA-256 implementation used synchronously by the editor.
  function sha256Bytes(input) {
    const bytes = input instanceof Uint8Array ? input : utf8Bytes(input);
    const bitLength = bytes.length * 8;
    const paddedLength = ((bytes.length + 9 + 63) >> 6) << 6;
    const message = new Uint8Array(paddedLength);
    message.set(bytes);
    message[bytes.length] = 0x80;
    const view = new DataView(message.buffer);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    view.setUint32(paddedLength - 8, high, false);
    view.setUint32(paddedLength - 4, low, false);

    const constants = new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ]);
    const words = new Uint32Array(64);
    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));

    for (let offset = 0; offset < message.length; offset += 64) {
      for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4, false);
      for (let index = 16; index < 64; index++) {
        const s0 = rotr(words[index - 15], 7) ^ rotr(words[index - 15], 18) ^ (words[index - 15] >>> 3);
        const s1 = rotr(words[index - 2], 17) ^ rotr(words[index - 2], 19) ^ (words[index - 2] >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for (let index = 0; index < 64; index++) {
        const sum1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
        const choose = (e & f) ^ (~e & g);
        const temp1 = (h + sum1 + choose + constants[index] + words[index]) >>> 0;
        const sum0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sum0 + majority) >>> 0;
        h=g; g=f; f=e; e=(d + temp1) >>> 0; d=c; c=b; b=a; a=(temp1 + temp2) >>> 0;
      }
      h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;
      h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
    }
    return [h0,h1,h2,h3,h4,h5,h6,h7].map(value => value.toString(16).padStart(8,"0")).join("");
  }

  function sha256Hex(value) {
    return sha256Bytes(canonicalText(value));
  }

  function fingerprint(value) {
    const digest = sha256Hex(value);
    return Object.freeze({ algorithm: "sha256", canonicalizationVersion: CANONICALIZATION_VERSION, digest, id: `sha256-${digest}` });
  }

  function stripIntegrity(value) {
    const copy = canonicalize(value || {});
    if (copy && typeof copy === "object") {
      delete copy.integrity;
      delete copy.signature;
    }
    return copy;
  }

  function base64Bytes(value) {
    const text = String(value || "").replace(/^base64:/, "");
    if (typeof atob === "function") return Uint8Array.from(atob(text), character => character.charCodeAt(0));
    if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(text, "base64"));
    throw new Error("Base64 decoding is unavailable.");
  }

  async function verifyEd25519(value, signature = {}) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return { ok: false, supported: false, error: "Web Crypto is unavailable." };
    try {
      const publicKey = base64Bytes(signature.publicKey || signature.key);
      const signatureBytes = base64Bytes(signature.signature || signature.value);
      const payload = utf8Bytes(canonicalText(stripIntegrity(value)));
      const key = await subtle.importKey("raw", publicKey, { name: "Ed25519" }, false, ["verify"]);
      const ok = await subtle.verify({ name: "Ed25519" }, key, signatureBytes, payload);
      return { ok, supported: true, algorithm: "ed25519", digest: sha256Hex(stripIntegrity(value)) };
    } catch (error) {
      return { ok: false, supported: true, error: error?.message || String(error) };
    }
  }

  const api = Object.freeze({
    version: VERSION,
    canonicalizationVersion: CANONICALIZATION_VERSION,
    canonicalize,
    canonicalText,
    sha256Hex,
    fingerprint,
    stripIntegrity,
    verifyEd25519
  });
  globalThis.HybridTileCryptoV18 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
