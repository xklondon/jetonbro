import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const root = process.cwd();
const out = path.join(root, "docs/screenshots/tabletop/approved-crops");
const sheets = [
  {
    file: "design/reference/classic/approved/ChatGPT Image Sep 22, 2026, 12_50_26 PM (1)(2).png",
    prefix: "player",
    expect: "9d53d58afcb294b5626abdbf6eb3739cfd6aad702ab0a607aa270b3707c5ed2e",
    names: ["betting", "playing", "insurance", "payout"],
  },
  {
    file: "design/reference/classic/approved/ChatGPT Image Sep 22, 2026, 12_50_27 PM (3)(2).png",
    prefix: "dealer",
    expect: "c401ddec54e305d60bcb4f6ce025f635afb184a405893e5f5bc69cb5f326c5d1",
    names: ["betting", "playing", "insurance", "payout"],
  },
  {
    file: "design/reference/classic/approved/ChatGPT Image Sep 22, 2026, 12_50_27 PM (2)(2).png",
    prefix: "setup",
    expect: "2ffa477db6ac46bae88c5abb3e43ac7c28b39e7aae753e2287d3e969fd3ba1ea",
    names: ["home", "create", "phase0", "game-select"],
  },
];

const notes = [];
for (const s of sheets) {
  const buf = fs.readFileSync(path.join(root, s.file));
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  if (sha !== s.expect) throw new Error(`SHA mismatch ${s.file}`);
  const meta = await sharp(buf).metadata();
  const pw = Math.floor(meta.width / 4);
  const ph = meta.height;
  const scale = Math.min(390 / pw, 844 / ph);
  const rw = Math.round(pw * scale);
  const rh = Math.round(ph * scale);
  const left = Math.floor((390 - rw) / 2);
  const top = Math.floor((844 - rh) / 2);
  for (let i = 0; i < 4; i++) {
    const panel = await sharp(buf)
      .extract({ left: i * pw, top: 0, width: pw, height: ph })
      .png()
      .toBuffer();
    const nativeName = `${s.prefix}-${s.names[i]}-native.png`;
    const framedName = `${s.prefix}-${s.names[i]}-390x844.png`;
    await sharp(panel).png().toFile(path.join(out, nativeName));
    const resized = await sharp(panel).resize(rw, rh, { fit: "fill" }).png().toBuffer();
    await sharp({ create: { width: 390, height: 844, channels: 3, background: "#06140f" } })
      .composite([{ input: resized, left, top }])
      .png()
      .toFile(path.join(out, framedName));
  }
  notes.push({
    sheet: s.file,
    sha,
    panelNative: `${pw}x${ph}`,
    scaled: `${rw}x${rh}`,
    letterbox: { left, top },
    method: "proportional-contain-on-390x844",
  });
}
fs.writeFileSync(path.join(out, "README.json"), JSON.stringify({ notes }, null, 2));
console.log(JSON.stringify(notes, null, 2));
