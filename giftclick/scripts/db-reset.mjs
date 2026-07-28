// Demo database reset: deletes the SQLite files. The next request re-seeds automatically.
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "data");
const files = ["giftclick.db", "giftclick.db-wal", "giftclick.db-shm"];

for (const f of files) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    console.log(`removed ${p}`);
  }
}
console.log("✅ DB reset done — hit any page (or restart the dev server) to re-seed demo data.");
