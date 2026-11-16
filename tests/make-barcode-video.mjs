// Erzeugt eine künstliche "Kamera" (Y4M-Video) mit einem EAN-13-Strichcode für den Scanner-Test.
// Aufruf: node tests/make-barcode-video.mjs 4008400402222 tests/barcode.y4m
import { writeFileSync } from 'node:fs';

const [code = '4008400402222', out = 'tests/barcode.y4m'] = process.argv.slice(2);
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = L.map((p) => [...p].map((b) => (b === '1' ? '0' : '1')).reverse().join(''));
const R = L.map((p) => [...p].map((b) => (b === '1' ? '0' : '1')).join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

const d = [...code].map(Number);
let bits = '101';
for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]];
bits += '01010';
for (let i = 7; i <= 12; i++) bits += R[d[i]];
bits += '101';

const W = 640;
const H = 480;
const module = 4;
const quiet = Math.floor((W - bits.length * module) / 2);
const Y = Buffer.alloc(W * H, 235);
for (let y = 140; y < 340; y++) {
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    for (let k = 0; k < module; k++) Y[y * W + quiet + i * module + k] = 16;
  }
}
const UV = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
const frames = 30;
const parts = [Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`)];
for (let f = 0; f < frames; f++) parts.push(Buffer.from('FRAME\n'), Y, UV);
writeFileSync(out, Buffer.concat(parts));
console.log(`Video mit Barcode ${code} geschrieben: ${out}`);
