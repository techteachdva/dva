/**
 * GTG campus — per-room 3D prop dressings (Three.js primitives only).
 */
import * as THREE from "three";

export const FLOOR_PALETTES = {
  start: { bg: "#1a1428", grid: "#9d8cff", accent: "#ffd54a" },
  design_lab: { bg: "#221830", grid: "#c49bff", accent: "#ff6688" },
  data_vault: { bg: "#101c28", grid: "#2dd4bf", accent: "#44ffcc" },
  password_temple: { bg: "#181820", grid: "#ffd54a", accent: "#ffaa00" },
  footprint_scene: { bg: "#201828", grid: "#c4a8ff", accent: "#ff88cc" },
  media_chamber: { bg: "#1c1424", grid: "#ff6688", accent: "#88ccff" },
  prepare_phase: { bg: "#142238", grid: "#44aa66", accent: "#88ddff" },
  try_phase: { bg: "#1a2030", grid: "#88aaff", accent: "#ffffff" },
  debug_scene: { bg: "#181828", grid: "#44ff88", accent: "#aaffcc" },
  reflect_phase: { bg: "#201828", grid: "#bb88ff", accent: "#ffcc88" },
  code_bay: { bg: "#1a1828", grid: "#66aaff", accent: "#ffdd44" },
  network_closet: { bg: "#121c18", grid: "#44ff88", accent: "#aaffaa" },
  sources_library: { bg: "#181c28", grid: "#88bbff", accent: "#ffcc66" },
  ip_chamber: { bg: "#201820", grid: "#cc88ff", accent: "#ffaa44" },
  collaboration_bridge: { bg: "#182028", grid: "#88ccff", accent: "#ffd54a" },
  trajectory_scene: { bg: "#281818", grid: "#ff8866", accent: "#ffcc44" },
  ai_ethics: { bg: "#1c1830", grid: "#aa88ff", accent: "#ff6688" },
  hardware_graveyard: { bg: "#1a2018", grid: "#88cc88", accent: "#44ff66" },
  open_source: { bg: "#182018", grid: "#88dd88", accent: "#ffd54a" },
  bias_unit: { bg: "#201828", grid: "#ff8866", accent: "#44aa66" },
  data_detective: { bg: "#181420", grid: "#bbaaff", accent: "#ffcc88" },
  final_trial: { bg: "#241830", grid: "#ffd54a", accent: "#ff88cc" },
};

const FLOOR_PATTERNS = {
  start: "holo",
  design_lab: "blueprint",
  data_vault: "vault",
  password_temple: "hex",
  footprint_scene: "steps",
  media_chamber: "wave",
  prepare_phase: "globe",
  try_phase: "checker",
  debug_scene: "terminal",
  reflect_phase: "chart",
  code_bay: "matrix",
  network_closet: "rack",
  sources_library: "books",
  ip_chamber: "vinyl",
  collaboration_bridge: "bridge",
  trajectory_scene: "orbit",
  ai_ethics: "split",
  hardware_graveyard: "scrap",
  open_source: "fork",
  bias_unit: "bars",
  data_detective: "magnify",
  final_trial: "arena",
};

export function makeRoomFloorTexture(roomId, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const ac = accent instanceof THREE.Color ? accent : new THREE.Color(accent || 0x9d8cff);
  const pal = FLOOR_PALETTES[roomId] || {
    bg: `#${ac.clone().multiplyScalar(0.35).getHexString()}`,
    grid: `#${ac.getHexString()}`,
    accent: `#${ac.clone().offsetHSL(0.05, 0.1, 0.2).getHexString()}`,
  };
  const seed = [...String(roomId)].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const pattern = FLOOR_PATTERNS[roomId] || "grid";

  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, 256, 256);

  // Circuit substrate traces on every room floor
  ctx.strokeStyle = pal.grid;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 2;
  for (let i = 32; i < 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 3;
  ctx.strokeStyle = pal.accent;
  for (let i = 64; i < 256; i += 64) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
  }
  ctx.fillStyle = pal.accent;
  ctx.globalAlpha = 0.35;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col + seed) % 5 === 0) {
        ctx.beginPath();
        ctx.arc(col * 32 + 16, row * 32 + 16, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.strokeStyle = pal.grid;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1.5;
  const step = pattern === "matrix" ? 16 : 32;
  for (let i = 0; i <= 256; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = pal.accent;
  ctx.strokeStyle = pal.accent;

  if (pattern === "hex") {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const cx = 28 + col * 48 + (row % 2) * 24;
        const cy = 28 + row * 42;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
          const px = cx + Math.cos(a) * 16;
          const py = cy + Math.sin(a) * 16;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else if (pattern === "wave") {
    ctx.lineWidth = 3;
    for (let w = 0; w < 4; w++) {
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const y = 64 + w * 48 + Math.sin(x * 0.05 + w) * 14;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (pattern === "checker") {
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        if ((gx + gy) % 2 === 0) ctx.fillRect(gx * 32, gy * 32, 32, 32);
      }
    }
  } else if (pattern === "bars") {
    for (let i = 0; i < 6; i++) {
      const h = 24 + (seed + i * 17) % 80;
      ctx.fillRect(24 + i * 38, 256 - h - 20, 22, h);
    }
  } else if (pattern === "orbit") {
    ctx.lineWidth = 2;
    for (let r = 30; r < 110; r += 28) {
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillRect(120, 118, 16, 16);
  } else {
    for (let i = 0; i < 7; i++) {
      const x = ((seed * (i + 3) * 17) % 190) + 24;
      const y = ((seed * (i + 7) * 13) % 190) + 24;
      const w = 14 + (i % 4) * 10;
      const h = 14 + (i % 3) * 8;
      if (pattern === "steps") ctx.fillRect(x, y, w, 6);
      else if (pattern === "terminal") ctx.strokeRect(x, y, w, h);
      else if (pattern === "fork") {
        ctx.fillRect(x, y + h / 2 - 2, w, 4);
        ctx.fillRect(x + w / 2 - 2, y, 4, h);
      } else ctx.fillRect(x, y, w, h);
    }
  }

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 18);
  ctx.fillRect(0, 238, 256, 18);
  ctx.fillRect(0, 0, 18, 256);
  ctx.fillRect(238, 0, 18, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 2.2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mat(color, emissive = null) {
  const c = typeof color === "number" ? new THREE.Color(color) : color;
  const m = new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.62,
    metalness: 0.14,
  });
  if (emissive != null) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = 0.55;
  }
  return m;
}

function glow(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
}

function box(w, h, d, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function cyl(rt, rb, h, seg, material, x, y, z, rx = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0);
  return m;
}

function neonStrip(group, x, y, z, len, color, axis = "x") {
  const geo = axis === "x"
    ? new THREE.BoxGeometry(len, 0.06, 0.06)
    : new THREE.BoxGeometry(0.06, 0.06, len);
  const strip = new THREE.Mesh(geo, glow(color));
  strip.position.set(x, y, z);
  group.add(strip);
}

function serverRack(group, x, z, count = 3, ledColor = 0x44ff88) {
  for (let i = 0; i < count; i++) {
    const y = 0.5 + i * 0.55;
    group.add(box(0.65, 0.45, 0.35, mat(0x1a1a28), x, y, z));
    group.add(box(0.5, 0.06, 0.02, glow(ledColor), x, y + 0.12, z + 0.18));
    for (let l = 0; l < 3; l++) {
      group.add(cyl(0.02, 0.02, 0.02, 6, glow(l % 2 ? 0xffaa00 : ledColor), x - 0.2 + l * 0.2, y + 0.2, z + 0.18));
    }
  }
}

function routerBox(group, x, y, z) {
  group.add(box(0.55, 0.12, 0.4, mat(0x222233), x, y, z));
  for (let i = 0; i < 4; i++) {
    group.add(cyl(0.03, 0.03, 0.18, 6, mat(0x888899), x - 0.15 + i * 0.1, y + 0.2, z - 0.15));
    group.add(box(0.04, 0.04, 0.04, glow(i % 2 ? 0x44ff44 : 0xffaa00), x - 0.15 + i * 0.1, y + 0.06, z + 0.12));
  }
}

function laptop(group, x, y, z, ry = 0) {
  group.add(box(0.7, 0.04, 0.5, mat(0x333344), x, y, z, 0, ry));
  group.add(box(0.65, 0.42, 0.04, mat(0x1a1a2e), x, y + 0.22, z - 0.22, -0.35, ry));
  group.add(box(0.55, 0.32, 0.02, glow(0x44aaff), x, y + 0.24, z - 0.24, -0.35, ry));
}

function microchip(group, x, y, z, scale = 1) {
  const s = scale;
  group.add(box(0.5 * s, 0.06 * s, 0.5 * s, mat(0x1a1a28), x, y, z));
  group.add(box(0.35 * s, 0.02 * s, 0.35 * s, glow(0xffd54a), x, y + 0.04 * s, z));
  for (let i = 0; i < 8; i++) {
    const side = i < 4;
    const idx = i % 4;
    const px = side ? x + (idx - 1.5) * 0.12 * s : x + (i < 6 ? -0.28 : 0.28) * s;
    const pz = side ? z + (i < 6 ? -0.28 : 0.28) * s : z + (idx - 1.5) * 0.12 * s;
    group.add(box(0.04 * s, 0.08 * s, 0.04 * s, mat(0x888899), px, y, pz));
  }
}

function antennaTower(group, x, z, h = 3.5) {
  group.add(cyl(0.04, 0.08, h, 6, mat(0x666677), x, h / 2, z));
  group.add(box(0.02, 0.6, 0.02, mat(0x888899), x, h - 0.2, z));
  group.add(box(0.02, 0.02, 0.6, mat(0x888899), x, h - 0.2, z));
  group.add(cyl(0.06, 0.06, 0.06, 8, glow(0xff4444), x, h + 0.1, z));
}

function cableBundle(group, x, y, z, len = 2) {
  for (let i = 0; i < 5; i++) {
    const off = (i - 2) * 0.04;
    group.add(cyl(0.025, 0.025, len, 6, mat(0x333344 + i * 0x050505), x + off, y, z, 0, Math.PI / 2));
  }
}

function hologramProjector(group, x, y, z) {
  group.add(cyl(0.35, 0.45, 0.15, 12, mat(0x2a2040), x, y, z));
  group.add(cyl(0.02, 0.02, 1.2, 6, glow(0x9d8cff), x, y + 0.7, z));
  group.add(box(0.8, 0.5, 0.02, glow(0x9d8cff), x, y + 1.3, z));
}

function droneProp(group, x, y, z) {
  group.add(box(0.35, 0.08, 0.35, mat(0x333344), x, y, z));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    group.add(cyl(0.25, 0.25, 0.02, 12, mat(0x555566), x + Math.cos(a) * 0.35, y + 0.06, z + Math.sin(a) * 0.35, Math.PI / 2));
    group.add(cyl(0.04, 0.04, 0.06, 6, mat(0x888899), x + Math.cos(a) * 0.35, y + 0.1, z + Math.sin(a) * 0.35));
  }
  group.add(cyl(0.06, 0.06, 0.12, 8, glow(0x44aaff), x, y + 0.1, z));
}

function satelliteDish(group, x, y, z) {
  group.add(cyl(0.04, 0.04, 0.8, 6, mat(0x666677), x, y, z));
  group.add(cyl(0.45, 0.15, 0.08, 16, mat(0x888899), x, y + 0.5, z, -0.5));
  group.add(cyl(0.06, 0.06, 0.12, 8, glow(0xff6644), x, y + 0.55, z, -0.5));
}

function bookStack(group, x, z, count, hue) {
  for (let i = 0; i < count; i++) {
    const h = 0.35 + (i % 3) * 0.08;
    const w = 0.28 + (i % 2) * 0.04;
    group.add(box(w, h, 0.18, mat(hue + i * 0x080808), x + i * 0.06, h / 2 + 0.02, z));
  }
}

function monitor(group, x, y, z, ry = 0) {
  group.add(box(0.9, 0.55, 0.06, mat(0x1a1a2e), x, y, z, 0, ry));
  group.add(box(0.95, 0.58, 0.02, glow(0x44ffcc), x, y, z + 0.04, 0, ry));
  group.add(box(0.15, 0.35, 0.12, mat(0x333344), x, y - 0.45, z, 0, ry));
}

function chair(group, x, z, color = 0x4a3d52) {
  group.add(box(0.55, 0.08, 0.55, mat(color), x, 0.35, z));
  group.add(box(0.55, 0.55, 0.08, mat(color), x, 0.65, z - 0.24));
}

function filmReel(group, x, y, z) {
  group.add(cyl(0.35, 0.35, 0.12, 16, mat(0x2a2a2a), x, y, z, Math.PI / 2));
  group.add(cyl(0.12, 0.12, 0.14, 12, mat(0x888888), x, y, z, Math.PI / 2));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    group.add(box(0.04, 0.22, 0.04, mat(0x555555), x + Math.cos(a) * 0.18, y, z + Math.sin(a) * 0.18));
  }
}

function vaultDoor(group, h) {
  const y = 1.85;
  const z = 4.55;
  const faceRx = Math.PI / 2; // cylinder axis along +Z → upright disc on building face

  group.add(cyl(1.55, 1.55, 0.14, 32, mat(0x3d3d48), 0, y, z, faceRx, 0));
  group.add(cyl(1.35, 1.35, 0.08, 32, mat(0x6a6a78), 0, y, z + 0.06, faceRx, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    group.add(box(0.08, 1.1, 0.06, mat(0x4a4a55), Math.sin(a) * 0.55, y + Math.cos(a) * 0.55, z + 0.1, 0, 0, a));
  }
  group.add(cyl(0.18, 0.18, 0.2, 16, mat(0xffd54a), 0, y, z + 0.14, faceRx, 0));
  group.add(cyl(0.08, 0.08, 0.25, 12, mat(0x222222), 0.55, y, z + 0.12, faceRx, 0));
  neonStrip(group, 0, h + 0.2, 4.2, 3.2, 0xffd54a, "x");
}

/** @param {THREE.Group} group building root (door faces +Z) */
export function decorateRoom(roomId, group, h, accent) {
  const a = accent instanceof THREE.Color ? accent : new THREE.Color(accent);
  const hi = a.clone().offsetHSL(0.05, 0.1, 0.15).getHex();
  const lo = a.clone().offsetHSL(-0.02, 0, -0.12).getHex();

  switch (roomId) {
    case "start":
      group.add(box(3.2, 0.12, 1.8, mat(0x2a2040), 0, 0.06, -2.5));
      group.add(box(3.4, 0.02, 1.9, glow(0x9d8cff), 0, 0.14, -2.5));
      group.add(box(2.4, 0.08, 1.2, mat(0x3a2850), 0, 0.75, 0));
      monitor(group, 0, 1.35, 0.6);
      monitor(group, -2.5, 1.2, -1.5, 0.3);
      monitor(group, 2.5, 1.2, -1.5, -0.3);
      laptop(group, -1.2, 0.75, 1.8, 0.2);
      laptop(group, 1.2, 0.75, 1.8, -0.2);
      hologramProjector(group, 0, 0.08, -1.2);
      chair(group, -2.2, -1.5);
      chair(group, 2.2, -1.5);
      chair(group, -2.2, 1.5);
      chair(group, 2.2, 1.5);
      bookStack(group, 3.2, 2.2, 3, 0x5c4033);
      serverRack(group, -3.5, -2.8, 2, 0x9d8cff);
      microchip(group, 3.5, 0.5, 0, 1.4);
      group.add(cyl(0.08, 0.08, 4.5, 8, mat(0xffd54a), -3.8, 2.25, -3.8));
      group.add(cyl(0.08, 0.08, 4.5, 8, mat(0xffd54a), 3.8, 2.25, -3.8));
      neonStrip(group, 0, h + 0.15, 4.3, 2.8, 0x9d8cff, "x");
      break;

    case "design_lab":
      group.add(box(2.8, 1.6, 0.08, mat(0xf5f5ff), -3.5, 1.5, 0, 0, Math.PI / 2));
      group.add(box(2.2, 1.2, 0.06, mat(hi), -3.48, 1.5, 0.05, 0, Math.PI / 2));
      group.add(box(0.12, 1.8, 0.12, mat(0x666677), -3.5, 0.9, 0.3, 0, Math.PI / 2));
      group.add(cyl(0.5, 0.5, 0.08, 16, mat(0xff4466), 3.2, 1.6, -2, Math.PI / 2));
      laptop(group, 2.8, 0.75, 1.5, -0.5);
      microchip(group, 1.5, 0.4, 2.8, 1.2);
      hologramProjector(group, 0, 0.08, 2.5);
      for (let i = 0; i < 3; i++) {
        group.add(box(0.5, 0.5, 0.5, mat(0x44aaff), 2.5 + i * 0.6, 0.25 + i * 0.15, 2 + i * 0.3));
      }
      neonStrip(group, -3.5, 2.4, 0, 1.6, 0x44ffaa, "z");
      break;

    case "data_vault":
      serverRack(group, -3, -3.2, 4, 0x2dd4bf);
      serverRack(group, -1.2, -3.2, 4, 0x44ffcc);
      for (let i = 0; i < 3; i++) {
        group.add(box(0.7, 2.2, 0.5, mat(0x1a2838), -3 + i * 0.9, 1.1, -3.2));
        group.add(box(0.55, 0.12, 0.02, glow(0x2dd4bf), -3 + i * 0.9, 1.8, -2.92));
      }
      group.add(box(1.2, 1.4, 0.08, mat(0x2dd4bf), 3.5, 1.2, 0, 0, -Math.PI / 2));
      group.add(cyl(0.35, 0.35, 0.5, 6, mat(0xffd54a), 3.5, 1.2, 0.3, 0, -Math.PI / 2));
      microchip(group, 2.5, 0.5, 2.5, 1.5);
      cableBundle(group, 0, 0.15, 3.2, 2.5);
      neonStrip(group, 0, h + 0.1, -3.5, 2.5, 0x2dd4bf, "x");
      break;

    case "password_temple":
      vaultDoor(group, h);
      for (let i = 0; i < 2; i++) {
        group.add(cyl(0.15, 0.08, 1.2, 8, mat(0xffd54a), -2.5 + i * 5, 0.6, 3.8));
      }
      break;

    case "footprint_scene":
      for (let i = 0; i < 5; i++) {
        group.add(box(0.5, 0.04, 0.7, mat(0x3a3050), -2 + i * 0.9, 0.02, 3.5, 0, 0.2 * i));
        group.add(box(0.35, 0.02, 0.5, glow(0xc4a8ff), -2 + i * 0.9, 0.05, 3.52, 0, 0.2 * i));
      }
      group.add(box(1.4, 2.2, 0.1, mat(0x888899), 3.6, 1.5, -1, 0, -0.3));
      break;

    case "media_chamber":
      bookStack(group, -3.2, -2.5, 4, 0x8b4513);
      bookStack(group, -2.2, -2.5, 3, 0x4a3728);
      filmReel(group, 3.2, 1.2, -2.5);
      filmReel(group, 3.8, 2.0, -2.5);
      group.add(box(0.5, 0.08, 0.72, mat(0xcccccc), 2.8, 0.8, 2.5));
      group.add(box(0.12, 0.12, 0.72, mat(0xffcc00), 2.95, 0.8, 2.5));
      monitor(group, -1, 1.2, 3.2);
      monitor(group, 1.2, 1.2, 3.2);
      group.add(box(1.6, 0.1, 0.9, mat(0x3a3050), 0, 0.65, 3.0));
      chair(group, -0.8, 2.2);
      chair(group, 0.8, 2.2);
      neonStrip(group, 0, h + 0.12, 3.5, 2.4, 0xff6688, "x");
      break;

    case "prepare_phase":
      group.add(cyl(1.1, 1.1, 1.1, 24, mat(0x2266aa), 0, 2.8, -3));
      group.add(cyl(1.05, 1.05, 1.05, 24, mat(0x44aa66), 0, 2.85, -3));
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        group.add(box(0.5, 0.8 + i * 0.15, 0.5, mat(hi), Math.cos(ang) * 2.8, 0.4, Math.sin(ang) * 2.8 - 2));
      }
      group.add(box(2.2, 0.1, 1.4, mat(0x334455), 0, 0.05, 2.8));
      monitor(group, 1.5, 1.1, 2.5);
      group.add(cyl(0.25, 0.35, 0.6, 12, mat(0x88ddff), -3, 0.3, 2.5));
      neonStrip(group, 0, 0.14, 2.8, 2.2, 0x44aa66, "x");
      break;

    case "try_phase":
      group.add(box(0.7, 0.7, 0.7, mat(0xffffff), -2.5, 0.35, 2.5));
      for (let i = 0; i < 5; i++) {
        group.add(box(0.18, 0.18, 0.18, mat(i % 2 ? 0x222222 : 0xeeeeee), -2.5 + (i % 3) * 0.2, 0.75 + Math.floor(i / 3) * 0.2, 2.5));
      }
      group.add(cyl(0.4, 0.4, 1.0, 8, mat(0x44aaff), 3, 0.5, -2.5));
      group.add(box(2.5, 0.08, 1.5, mat(0x333344), 0, 0.04, 3.5));
      for (let i = 0; i < 3; i++) {
        group.add(cyl(0.22, 0.22, 0.08, 12, mat(i === 1 ? 0xffffff : 0x111111), -1 + i * 1, 0.9, 3.2));
      }
      group.add(box(1.2, 0.6, 0.08, mat(0x1a1a2e), 3.2, 1.4, 2.5, 0, -0.4));
      neonStrip(group, 3.2, 1.75, 2.5, 1.0, 0x88aaff, "z");
      break;

    case "debug_scene":
      group.add(box(2.5, 0.8, 0.08, mat(0x1a1a2e), -3.5, 1.2, 0, 0, Math.PI / 2));
      group.add(box(2.3, 0.6, 0.02, glow(0x44ff44), -3.48, 1.2, 0.05, 0, Math.PI / 2));
      laptop(group, 2.5, 0.75, 1.5, -0.3);
      serverRack(group, 3, -2.5, 2, 0x44ff88);
      microchip(group, 0, 0.45, 2.8, 1.3);
      group.add(cyl(0.45, 0.25, 0.35, 6, mat(0x88cc44), 3, 0.5, 2.5));
      group.add(box(0.6, 0.15, 0.3, mat(0x88cc44), 3.3, 0.85, 2.3, 0, -0.5));
      for (let i = 0; i < 3; i++) {
        group.add(box(0.15, 0.4, 0.02, glow(0xff4444), -3.2, 1.5 - i * 0.25, 0.06, 0, Math.PI / 2));
      }
      break;

    case "reflect_phase":
      group.add(box(1.8, 1.0, 0.12, mat(0x2a2040), 0, 1.2, -3.4));
      group.add(box(0.35, 0.08, 0.25, mat(0x333344), -0.5, 0.65, -3.3));
      group.add(cyl(0.12, 0.12, 0.08, 12, mat(0xff4466), 0.3, 0.7, -3.28, Math.PI / 2));
      for (let i = 0; i < 3; i++) {
        group.add(cyl(0.08, 0.08, 0.02, 8, mat(0xffd54a), -0.4 + i * 0.4, 1.85, -3.35, Math.PI / 2));
      }
      break;

    case "code_bay":
      for (let gx = 0; gx < 4; gx++) {
        for (let gz = 0; gz < 4; gz++) {
          if ((gx + gz) % 2 === 0) {
            group.add(box(0.45, 0.06, 0.45, mat(0x334455), -1.5 + gx * 0.5, 0.03, 2.5 + gz * 0.5));
          }
        }
      }
      serverRack(group, -3, 2.5, 3, 0x44ffcc);
      laptop(group, 1.5, 0.75, 2.5);
      microchip(group, 0, 0.4, 3, 1.8);
      group.add(box(0.8, 1.0, 0.6, mat(0x8899aa), 3, 0.5, -2));
      group.add(box(0.5, 0.15, 0.15, glow(0x44ffcc), 3, 1.1, -1.85));
      group.add(box(0.15, 0.5, 0.15, mat(0x667788), 3.2, 0.5, -2));
      break;

    case "network_closet":
      serverRack(group, -3.2, -2.5, 4, 0x44ff44);
      routerBox(group, 2.5, 0.5, -2);
      routerBox(group, 3.2, 1.2, 0.5);
      for (let i = 0; i < 4; i++) {
        group.add(box(0.55, 0.35, 0.4, mat(0x2a2a35), -3.2, 0.5 + i * 0.45, -2.5));
        group.add(box(0.4, 0.08, 0.02, glow(i % 2 ? 0x44ff44 : 0xffaa00), -3.2, 0.65 + i * 0.45, -2.28));
      }
      cableBundle(group, 0, 0.2, 0, 3.5);
      antennaTower(group, 3.5, 2, 2.8);
      neonStrip(group, -3.2, 2.5, -2.5, 1.2, 0x44ff44, "z");
      break;

    case "sources_library":
      for (let s = 0; s < 3; s++) {
        group.add(box(0.15, 2.4, 1.2, mat(0x5c4033), -3.5 + s * 1.1, 1.2, -2.8));
        bookStack(group, -3.5 + s * 1.1, -2.2, 5 - s, 0x6b4423 + s * 0x111111);
      }
      bookStack(group, 2.5, -2.5, 4, 0x8b6914);
      group.add(cyl(0.5, 0.35, 0.08, 16, mat(0x888899), 3.2, 0.5, 2.5));
      group.add(cyl(0.08, 0.08, 0.6, 8, mat(0x555566), 3.2, 0.85, 2.5));
      monitor(group, 0, 1.0, 3.3);
      group.add(box(1.4, 0.1, 0.7, mat(0x4a3d52), 0, 0.65, 3.0));
      chair(group, -0.6, 2.5);
      break;

    case "ip_chamber":
      group.add(cyl(0.55, 0.55, 0.06, 24, mat(0x1a1a1a), -2.5, 0.5, 2.5));
      group.add(cyl(0.15, 0.15, 0.08, 16, mat(0x333333), -2.5, 0.55, 2.5));
      for (let i = 0; i < 4; i++) {
        group.add(box(0.08, 0.35, 0.02, mat(0xcccccc), -2.5 + Math.cos(i * 1.2) * 0.35, 0.9, 2.5 + Math.sin(i * 1.2) * 0.35));
      }
      group.add(box(0.08, 1.2, 0.08, mat(0xffd54a), 3.2, 1.5, -2));
      group.add(box(0.6, 0.08, 0.08, mat(0xffd54a), 3.2, 2.0, -2));
      group.add(box(0.08, 0.08, 0.6, mat(0xffd54a), 3.2, 1.5, -1.7));
      break;

    case "collaboration_bridge":
      group.add(box(4, 0.25, 0.8, mat(0x556677), 0, 3.5, -3.5));
      group.add(box(0.25, 3.5, 0.25, mat(0x667788), -2, 1.75, -3.5));
      group.add(box(0.25, 3.5, 0.25, mat(0x667788), 2, 1.75, -3.5));
      for (let i = 0; i < 3; i++) {
        group.add(box(0.5, 0.35, 0.02, glow(0x88ccff), -1 + i * 1, 2.2, 3.2));
      }
      break;

    case "trajectory_scene":
      group.add(cyl(0.35, 0.55, 2.5, 8, mat(0xcc4444), 3, 1.25, -2.5));
      group.add(cyl(0.2, 0.35, 0.6, 8, mat(0xff6644), 3, 2.6, -2.2, -0.4));
      droneProp(group, -2.5, 1.5, 2);
      satelliteDish(group, -1, 3.2, -2);
      for (let i = 0; i < 4; i++) {
        group.add(cyl(0.04, 0.04, 0.04, 6, mat(0xffffff), -2 + i * 0.8, 0.5 + i * 0.4, 3));
      }
      break;

    case "ai_ethics":
      group.add(box(0.12, 2.2, 0.12, mat(0x888899), 0, 1.5, 3));
      group.add(box(1.8, 0.1, 0.35, mat(0x666677), 0, 1.5, 3));
      group.add(box(0.5, 0.5, 0.08, mat(0x44aaff), -0.8, 1.85, 3.05));
      group.add(box(0.5, 0.5, 0.08, mat(0xff6688), 0.8, 1.85, 3.05));
      monitor(group, -2.5, 1.2, 0, Math.PI / 2);
      monitor(group, 2.5, 1.2, 0, -Math.PI / 2);
      microchip(group, 0, 0.5, -2, 2);
      for (let i = 0; i < 2; i++) {
        group.add(box(0.35, 0.5, 0.06, mat(i ? 0x44aaff : 0xff6688), -2.5 + i * 5, 1.2, -2.5));
      }
      break;

    case "hardware_graveyard":
      for (let i = 0; i < 4; i++) {
        group.add(box(0.35, 0.6, 0.08, mat(0x333344), -2 + i * 0.5, 0.3 + i * 0.08, 2.8, 0, 0.3 * i));
        group.add(box(0.28, 0.45, 0.02, glow(0x44ff44), -2 + i * 0.5, 0.35 + i * 0.08, 2.85, 0, 0.3 * i));
      }
      group.add(box(1.0, 0.8, 0.8, mat(0x2a3530), 3, 0.4, -2.5));
      group.add(box(0.7, 0.12, 0.02, glow(0xff4444), 3, 0.85, -2.1));
      laptop(group, -3, 0.75, -1.5, 0.4);
      serverRack(group, 2.5, 2.8, 2, 0x88cc88);
      microchip(group, 0, 0.35, -2.5, 1.1);
      break;

    case "open_source":
      group.add(box(0.08, 1.8, 1.2, mat(0xf5e6c8), -3.2, 0.9, 0));
      group.add(box(1.0, 0.08, 0.08, mat(0xffd54a), 3, 1.5, -2.5));
      group.add(box(0.08, 0.08, 1.0, mat(0xffd54a), 3, 1.5, -2));
      group.add(box(0.6, 0.5, 0.5, mat(0x44aa66), 2.5, 0.25, 2.5));
      for (let i = 0; i < 3; i++) {
        group.add(box(0.35, 0.5, 0.35, mat(i % 2 ? 0x44aa66 : 0x88dd88), -1 + i * 1.2, 0.25, -2.5));
      }
      bookStack(group, -2.5, 2.8, 3, 0x5c4033);
      neonStrip(group, 0, 0.14, -2.8, 2.4, 0x88dd88, "x");
      break;

    case "bias_unit":
      for (let i = 0; i < 4; i++) {
        const bh = 0.4 + i * 0.35;
        group.add(box(0.35, bh, 0.35, mat(i < 2 ? 0x44aa66 : 0xff6644), -1.5 + i * 0.9, bh / 2, 3));
      }
      group.add(box(1.6, 0.08, 0.5, mat(0x555566), 0, 0.04, 3.2));
      monitor(group, 3, 1.2, 0, Math.PI / 2);
      group.add(box(0.8, 0.08, 0.5, mat(0x333344), 3, 0.65, 0));
      neonStrip(group, -1.5, 2.2, 3, 2.8, 0xff8866, "x");
      break;

    case "data_detective":
      group.add(cyl(0.55, 0.4, 0.12, 16, mat(0x888899), 3, 0.5, 2.5));
      group.add(cyl(0.08, 0.08, 0.5, 8, mat(0x444455), 3.45, 0.85, 2.5));
      group.add(box(0.7, 0.25, 0.5, mat(0x3a2a1a), 3, 1.5, 2.5));
      for (let i = 0; i < 3; i++) {
        group.add(cyl(0.12, 0.12, 0.02, 12, mat(0x666677), -2.5 + i * 0.5, 1.5, -2.5));
      }
      break;

    case "final_trial":
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        group.add(cyl(0.06, 0.08, 2.8, 6, mat(0xffd54a), Math.cos(ang) * 4.8, 1.4, Math.sin(ang) * 4.8));
      }
      group.add(cyl(0.9, 0.9, 0.08, 24, mat(0xffd54a), 0, 0.05, 0));
      neonStrip(group, 0, 0.12, 0, 4.2, 0xffd54a, "x");
      neonStrip(group, 0, 0.12, 0, 4.2, 0xffd54a, "z");
      break;

    default:
      for (let i = 0; i < 3; i++) {
        group.add(box(0.4 + i * 0.1, 0.5 + i * 0.2, 0.4, mat(hi), -2 + i * 2, 0.25, 2.5 - i * 0.4));
      }
      group.add(cyl(0.35, 0.45, 0.08, 12, mat(lo), 3, 0.5, -2));
      neonStrip(group, 0, h + 0.1, 4.2, 2, hi, "x");
      break;
  }
}

/** Silhouette / roof accent per room for distinct building shapes. */
export function roomSilhouette(roomId, group, h, color) {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  switch (roomId) {
    case "password_temple":
    case "data_vault":
      return { h: h + 1, roof: "flat", trim: 0xffd54a };
    case "media_chamber":
    case "sources_library":
      return { h: h + 0.5, roof: "flat", trim: 0xff6688 };
    case "final_trial":
      return { h: h + 2, roof: "dome", trim: 0xffd54a };
    case "network_closet":
      return { h: h - 1, roof: "antenna", trim: 0x44ff44 };
    case "collaboration_bridge":
      return { h: h + 1.5, roof: "arch", trim: 0x88ccff };
    case "prepare_phase":
      return { h: h + 0.8, roof: "dome", trim: 0x44aa66 };
    case "try_phase":
      return { h: h + 0.4, roof: "pyramid", trim: 0x88aaff };
    case "debug_scene":
      return { h: h + 0.3, roof: "antenna", trim: 0x44ff88 };
    case "ai_ethics":
      return { h: h + 1.2, roof: "arch", trim: 0xaa88ff };
    case "hardware_graveyard":
      return { h: h - 0.5, roof: "flat", trim: 0x88cc88 };
    case "open_source":
      return { h: h + 0.6, roof: "pyramid", trim: 0x88dd88 };
    case "footprint_scene":
      return { h: h + 0.5, roof: "flat", trim: 0xc4a8ff };
    case "design_lab":
      return { h: h + 0.7, roof: "dome", trim: 0xc49bff };
    default:
      return { h, roof: "pyramid", trim: c.clone().offsetHSL(0.05, 0.2, 0.2).getHex() };
  }
}

export function addWindows(group, h, tint, glowMats = null) {
  const tc = tint instanceof THREE.Color ? tint : new THREE.Color(tint);
  const winMat = new THREE.MeshStandardMaterial({
    color: tc,
    emissive: tc.clone(),
    emissiveIntensity: 0.72,
    roughness: 0.35,
    metalness: 0.12,
    transparent: true,
    opacity: 0.9,
  });
  if (glowMats) glowMats.push(winMat);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      group.add(box(0.55, 0.7, 0.04, winMat, -1.1 + col * 2.2, 1.8 + row * 1.4, 4.48));
    }
  }
}
