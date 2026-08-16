/**
 * Small non-blocking dressing props for tables and floors.
 */

import * as THREE from '../../vendor/three.module.js';
import { TABLE } from '../config.js';

function makePixelArtTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const palette = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#2c3e50'];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = palette[(x + y) % palette.length];
      g.fillRect(x * 4, y * 4, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDiceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f4f8';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#1a1f2a';
  const dots = [[16, 16], [48, 48], [16, 48], [48, 16], [32, 32]];
  for (const [x, y] of dots) {
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * @param {import('./lab.js').Lab} lab
 * @param {Array<{ type: string, x: number, z: number, surface: string, rot: number }>} items
 */
export function buildScatterProps(lab, items) {
  const group = lab.group;
  const disposables = lab._disposables;
  const glowSources = lab.glowSources;
  const rng = lab.rng;

  const tableY = TABLE.topY + TABLE.topThickness / 2 + 0.01;

  for (const item of items) {
    const yBase = item.surface === 'table' ? tableY : 0.02;
    const g = new THREE.Group();
    g.position.set(item.x, yBase, item.z);
    g.rotation.y = item.rot;

    switch (item.type) {
      case 'pencil':
        const pencil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6),
          new THREE.MeshLambertMaterial({ color: 0xf4c542 }),
        );
        pencil.rotation.z = Math.PI / 2;
        pencil.position.y = 0.012;
        g.add(pencil);
        disposables.push(pencil.geometry, pencil.material);
        break;

      case 'notebook':
        const nb = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.028, 0.3),
          new THREE.MeshLambertMaterial({ color: 0x2a3548 }),
        );
        nb.position.y = 0.014;
        g.add(nb);
        const marble = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.004, 0.28),
          new THREE.MeshLambertMaterial({ color: 0xe8ecf2 }),
        );
        marble.position.set(0, 0.028, 0);
        g.add(marble);
        disposables.push(nb.geometry, nb.material, marble.geometry, marble.material);
        break;

      case 'eraser':
        const eraser = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.04, 0.05),
          new THREE.MeshLambertMaterial({ color: 0xff8fa8 }),
        );
        eraser.position.y = 0.02;
        g.add(eraser);
        disposables.push(eraser.geometry, eraser.material);
        break;

      case 'wire':
        const wireMat = new THREE.MeshLambertMaterial({ color: 0x6a7380 });
        for (let w = 0; w < 3; w++) {
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 5), wireMat);
          seg.rotation.z = rng.range(-0.4, 0.4);
          seg.rotation.x = rng.range(-0.5, 0.5);
          seg.position.set(rng.range(-0.08, 0.08), 0.01, rng.range(-0.08, 0.08));
          g.add(seg);
          disposables.push(seg.geometry);
        }
        disposables.push(wireMat);
        break;

      case 'circuit':
        const pcb = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.012, 0.1),
          new THREE.MeshLambertMaterial({ color: 0x1a5c3a }),
        );
        pcb.position.y = 0.006;
        g.add(pcb);
        for (let i = 0; i < 4; i++) {
          const chip = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.02, 0.02),
            new THREE.MeshLambertMaterial({ color: 0x222830 }),
          );
          chip.position.set(-0.04 + i * 0.025, 0.016, 0);
          g.add(chip);
          disposables.push(chip.geometry, chip.material);
        }
        disposables.push(pcb.geometry, pcb.material);
        break;

      case 'dice':
        const diceTex = makeDiceTexture();
        const dice = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.07, 0.07),
          new THREE.MeshLambertMaterial({ map: diceTex }),
        );
        dice.position.y = 0.035;
        g.add(dice);
        disposables.push(dice.geometry, dice.material, diceTex);
        break;

      case 'meeple':
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.05, 0.08, 8),
          new THREE.MeshLambertMaterial({ color: 0x4d96ff }),
        );
        body.position.y = 0.04;
        g.add(body);
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0x4d96ff }),
        );
        head.position.y = 0.1;
        g.add(head);
        disposables.push(body.geometry, body.material, head.geometry, head.material);
        break;

      case 'camera':
        const camBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.07, 0.05),
          new THREE.MeshLambertMaterial({ color: 0x1c222c }),
        );
        camBody.position.y = 0.035;
        g.add(camBody);
        const lens = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.032, 0.04, 10),
          new THREE.MeshLambertMaterial({ color: 0x3a4558 }),
        );
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, 0.035, 0.045);
        g.add(lens);
        disposables.push(camBody.geometry, camBody.material, lens.geometry, lens.material);
        break;

      case 'bulb':
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.03, 0.04, 8),
          new THREE.MeshLambertMaterial({ color: 0x8a9098 }),
        );
        base.position.y = 0.02;
        g.add(base);
        const glass = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
        );
        glass.position.y = 0.07;
        g.add(glass);
        disposables.push(base.geometry, base.material, glass.geometry, glass.material);
        glowSources.push({
          pos: new THREE.Vector3(item.x, yBase + 0.12, item.z),
          color: 0xffe9a8,
          intensity: 4.2,
          distance: 5.5,
          active: true,
        });
        break;

      case 'cpx':
        buildCircuitPlayground(g, disposables);
        break;

      case 'pixelArt':
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.22, 0.02),
          new THREE.MeshLambertMaterial({ color: 0x2a3038 }),
        );
        frame.position.y = item.surface === 'table' ? 0.11 : 0.11;
        g.add(frame);
        const pixTex = makePixelArtTexture();
        const art = new THREE.Mesh(
          new THREE.PlaneGeometry(0.14, 0.14),
          new THREE.MeshBasicMaterial({ map: pixTex }),
        );
        art.position.set(0, item.surface === 'table' ? 0.11 : 0.11, 0.012);
        g.add(art);
        if (item.surface === 'floor') {
          g.rotation.x = -0.35;
        }
        disposables.push(frame.geometry, frame.material, art.geometry, art.material, pixTex);
        break;

      default:
        break;
    }

    group.add(g);
  }
}

function buildCircuitPlayground(g, disposables) {
  const boardMat = new THREE.MeshLambertMaterial({ color: 0x0d4a4a });
  const board = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 16), boardMat);
  board.position.y = 0.006;
  g.add(board);

  const neoColors = [0xff0040, 0xff8000, 0xffff00, 0x00ff80, 0x00cfff, 0x8040ff];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 6, 4),
      new THREE.MeshBasicMaterial({ color: neoColors[i % neoColors.length] }),
    );
    led.position.set(Math.cos(a) * 0.042, 0.014, Math.sin(a) * 0.042);
    g.add(led);
    disposables.push(led.geometry, led.material);
  }

  const usb = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.015, 0.03),
    new THREE.MeshLambertMaterial({ color: 0xb0b8c4 }),
  );
  usb.position.set(0.055, 0.008, 0);
  g.add(usb);

  for (const sx of [-0.015, 0.015]) {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.006, 10),
      new THREE.MeshLambertMaterial({ color: 0x1a222e }),
    );
    btn.position.set(sx, 0.012, 0);
    g.add(btn);
    disposables.push(btn.geometry, btn.material);
  }

  disposables.push(board.geometry, boardMat, usb.geometry, usb.material);
}
