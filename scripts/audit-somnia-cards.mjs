#!/usr/bin/env node
/** Audit Somnia card data — run: node scripts/audit-somnia-cards.mjs */
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const py = process.platform === "win32" ? "py" : "python3";
const script = path.join(__dirname, "audit-somnia-cards.py");
const result = spawnSync(py, [script], { stdio: "inherit" });
process.exit(result.status ?? 1);
