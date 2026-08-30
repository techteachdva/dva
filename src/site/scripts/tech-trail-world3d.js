/**
 * DaVinci Dragons — 3D campus world (Three.js).
 * ES module; reads window.TechTrailVisuals and calls app.js through window.TechTrailWorld.
 * If WebGL is unavailable or anything fails during boot, the world never activates
 * and the flat game is untouched.
 */
import * as THREE from "three";
import { decorateRoom, roomSilhouette, makeRoomFloorTexture, FLOOR_PALETTES } from "./tech-trail-world3d-props.js";

(() => {
  const WORLD_HALF_X = 88;
  const WORLD_HALF_Z = 80;
  const WALK_SPEED = 6.5;
  const RUN_SPEED = 11;
  const TURN_SPEED = 2.4;
  const DOOR_REACH = 3.4;
  const PLAYER_RADIUS = 0.55;
  const CAM_DIST = 9.5;
  const CAM_HEIGHT = 3.2;

  const MENTOR_ROOMS = {
    guide: "start",
    lovelace: "design_lab",
    turing: "data_vault",
    hopper: "debug_scene",
    johnson: "sources_library",
    babbage: "network_closet",
    wright: "prepare_phase",
    meier: "try_phase",
    campbell: "collaboration_bridge",
    crawford: "ip_chamber",
    conway: "reflect_phase",
    lamarr: "network_closet",
    perlman: "network_closet",
    hamilton: "code_bay",
    sweeney: "data_detective",
    buolamwini: "ai_ethics",
    west: "hardware_graveyard",
    noble: "media_chamber",
  };

  const GOLDEN_ROOMS = new Set(["design_lab", "data_vault", "password_temple", "footprint_scene", "media_chamber"]);

  function parseTint(rgba) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(rgba || ""));
    if (!m) return new THREE.Color(0x6b5b8e);
    return new THREE.Color(Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255);
  }

  function downscaleTexture(url, size) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = size / Math.max(img.width, img.height);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function textSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(10, 6, 18, 0.72)";
    ctx.beginPath();
    ctx.roundRect(6, 24, 500, 80, 18);
    ctx.fill();
    ctx.font = "600 44px 'Bebas Neue', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f5e9ff";
    ctx.fillText(text, 256, 66, 470);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(9, 2.25, 1);
    return sprite;
  }

  function groundTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(256, 256, 30, 256, 256, 290);
    g.addColorStop(0, "#14101e");
    g.addColorStop(1, "#08060e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(90, 72, 140, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(120, 100, 180, 0.08)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    ctx.fillStyle = "rgba(60, 48, 96, 0.35)";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 0) ctx.fillRect(col * 64 + 2, row * 64 + 2, 60, 60);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function segmentKey(x1, z1, x2, z2) {
    const a = `${Math.round(x1 * 4)},${Math.round(z1 * 4)}`;
    const b = `${Math.round(x2 * 4)},${Math.round(z2 * 4)}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function routeEdge(ax, az, bx, bz, padA, padB) {
    const dx = bx - ax;
    const dz = bz - az;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) return [];
    const ux = dx / dist;
    const uz = dz / dist;
    const sx = ax + ux * padA;
    const sz = az + uz * padA;
    const ex = bx - ux * padB;
    const ez = bz - uz * padB;
    if (Math.abs(ex - sx) < 0.5) return [{ x1: sx, z1: sz, x2: ex, z2: ez }];
    if (Math.abs(ez - sz) < 0.5) return [{ x1: sx, z1: sz, x2: ex, z2: ez }];
    const cornerX = ex;
    const cornerZ = sz;
    return [
      { x1: sx, z1: sz, x2: cornerX, z2: cornerZ },
      { x1: cornerX, z1: cornerZ, x2: ex, z2: ez },
    ];
  }

  function buildMeeplePlayer() {
    const group = new THREE.Group();
    const skin = stdMat(0xd8c8f0, { roughness: 0.48, metalness: 0.06 });
    const accent = stdMat(0xffd54a, { emissive: 0xc9a020, emissiveIntensity: 0.35 });
    const limb = stdMat(0xb8a8d8, { roughness: 0.55 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.1, 14), accent);
    base.position.y = 0.05;
    base.castShadow = true;
    group.add(base);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.62, 12), skin);
    torso.position.y = 0.44;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), skin);
    head.position.y = 0.92;
    head.castShadow = true;
    group.add(head);

    const armGeo = new THREE.BoxGeometry(0.1, 0.42, 0.1);
    const legGeo = new THREE.BoxGeometry(0.12, 0.38, 0.12);
    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(armGeo, limb);
      arm.position.set(side * 0.34, 0.48, 0);
      arm.rotation.z = side * 0.25;
      arm.castShadow = true;
      group.add(arm);
      const leg = new THREE.Mesh(legGeo, limb);
      leg.position.set(side * 0.14, 0.19, 0.02);
      leg.castShadow = true;
      group.add(leg);
    });

    group.scale.setScalar(1.18);
    return group;
  }

  function skyDome() {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#06040c");
    grad.addColorStop(0.25, "#12081c");
    grad.addColorStop(0.55, "#1e1030");
    grad.addColorStop(0.85, "#2a1840");
    grad.addColorStop(1, "#3a2248");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 512);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * 220;
      ctx.fillStyle = `rgba(255,248,240,${0.15 + Math.random() * 0.55})`;
      ctx.fillRect(Math.random() * 4, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
      new THREE.SphereGeometry(190, 36, 18),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    );
  }

  function stdMat(color, opts = {}) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const base = c.clone().multiplyScalar(0.88).lerp(new THREE.Color(0x2a2040), 0.28);
    return new THREE.MeshStandardMaterial({
      color: base,
      roughness: opts.roughness ?? 0.68,
      metalness: opts.metalness ?? 0.12,
      emissive: opts.emissive != null ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    });
  }

  function boot() {
    if (window.__gtgWorld3D?.ready) return;

    const Visuals = window.TechTrailVisuals;
    const bridge = window.TechTrailWorld;
    const root = document.getElementById("worldRoot");
    if (!Visuals || !bridge || !root) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (err) {
      document.body.classList.add("tt-flat");
      return;
    }

    window.__gtgWorld3D = { active: true, ready: false, requestWalkTo: null, enterRoom: null, resize: null };

    // --- renderer / scene basics -------------------------------------------------
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.appendChild(renderer.domElement);
    renderer.domElement.classList.add("tt-world__canvas");
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("aria-label", "Campus walk view");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0612);
    scene.fog = new THREE.FogExp2(0x1a1028, 0.0042);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);

    scene.add(skyDome());

    const hemi = new THREE.HemisphereLight(0xb8a8ff, 0x1a0f24, 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe4b8, 1.15);
    sun.position.set(55, 85, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = -95;
    sun.shadow.camera.right = 95;
    sun.shadow.camera.top = 95;
    sun.shadow.camera.bottom = -95;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6a4aff, 0.35);
    fill.position.set(-40, 30, -50);
    scene.add(fill);

    const groundTex = groundTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({
        map: groundTex,
        color: 0xffffff,
        roughness: 0.92,
        metalness: 0.04,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    const clickables = [];

    const reducedMotion = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.body.classList.contains("tt-still-camera");

    // --- campus layout -----------------------------------------------------------
    const roomPos = (room) => ({
      x: ((room.x - 50) / 50) * WORLD_HALF_X,
      z: ((room.y - 45) / 45) * WORLD_HALF_Z,
    });

    const neighborsOf = {};
    Visuals.MAP_EDGES.forEach(([a, b]) => {
      (neighborsOf[a] = neighborsOf[a] || []).push(b);
      (neighborsOf[b] = neighborsOf[b] || []).push(a);
    });

    const buildings = new Map(); // roomId -> { group, doorPosition, ringMat, room }

    const ROOM_MENTOR = {};
    Object.entries(MENTOR_ROOMS).forEach(([mentor, roomId]) => {
      if (!ROOM_MENTOR[roomId]) ROOM_MENTOR[roomId] = mentor;
    });

    function buildRoom(room) {
      const { x, z } = roomPos(room);
      const zoneKey = Visuals.NODE_ZONE?.[room.id] || "dragons";
      const zone = Visuals.ZONES[zoneKey] || Visuals.ZONES.dragons;
      const color = parseTint(zone.tint);
      const golden = GOLDEN_ROOMS.has(room.id);
      const padW = room.id === "final_trial" ? 14 : 12;
      const padD = room.id === "final_trial" ? 13 : 11;
      const padH = 3.2;

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const toCenter = Math.atan2(-x, -z);
      group.rotation.y = toCenter;

      const sil = roomSilhouette(room.id, group, padH, color);
      const trimColor = sil.trim || 0x9d8cff;

      const floorTex = makeRoomFloorTexture(room.id, color);
      const pal = FLOOR_PALETTES[room.id];
      const floorTint = pal ? new THREE.Color(pal.bg) : color.clone().multiplyScalar(0.55);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(padW, padD),
        new THREE.MeshStandardMaterial({
          map: floorTex,
          color: floorTint,
          roughness: 0.82,
          metalness: 0.08,
          emissive: new THREE.Color(pal?.accent || trimColor),
          emissiveIntensity: golden ? 0.12 : 0.04,
        })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.1;
      floor.receiveShadow = true;
      floor.userData = { type: "floor", roomId: room.id };
      group.add(floor);

      const border = new THREE.Mesh(
        new THREE.RingGeometry(Math.min(padW, padD) * 0.46, Math.min(padW, padD) * 0.5, 48),
        new THREE.MeshBasicMaterial({ color: trimColor, transparent: true, opacity: golden ? 0.9 : 0.55 })
      );
      border.rotation.x = -Math.PI / 2;
      border.position.y = 0.12;
      group.add(border);

      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6),
          stdMat(trimColor, { metalness: 0.25 })
        );
        post.position.set(sx * padW * 0.44, 1.3, sz * padD * 0.44);
        post.castShadow = true;
        group.add(post);
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshBasicMaterial({ color: golden ? 0xffd54a : trimColor })
        );
        cap.position.set(sx * padW * 0.44, 2.65, sz * padD * 0.44);
        group.add(cap);
      });

      if (golden) {
        const accent = new THREE.PointLight(0xffd54a, 0.5, 18);
        accent.position.set(0, 2.5, 0);
        group.add(accent);
      } else if (pal) {
        const zoneLight = new THREE.PointLight(new THREE.Color(pal.accent), 0.28, 14);
        zoneLight.position.set(0, 2.2, 0);
        group.add(zoneLight);
      }

      decorateRoom(room.id, group, padH, color);

      const label = textSprite(`${room.icon} ${room.label}`);
      label.position.y = 4.2;
      label.visible = false;
      group.add(label);

      const markerMat = new THREE.MeshStandardMaterial({
        color: trimColor,
        emissive: new THREE.Color(trimColor),
        emissiveIntensity: 0.45,
        roughness: 0.4,
        metalness: 0.2,
      });
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.4, 8), markerMat);
      marker.position.set(0, 1.7, -padD * 0.38);
      marker.castShadow = true;
      group.add(marker);
      const markerCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        new THREE.MeshBasicMaterial({ color: golden ? 0xffd54a : trimColor })
      );
      markerCap.position.set(0, 3.55, -padD * 0.38);
      group.add(markerCap);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x4a3d63, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(5.8, 6.5, 40), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.11;
      group.add(ring);

      scene.add(group);

      const doorDir = new THREE.Vector3(Math.sin(toCenter), 0, Math.cos(toCenter));
      const doorDist = Math.max(padW, padD) * 0.48;
      const doorWorld = new THREE.Vector3(x, 0, z).addScaledVector(doorDir, doorDist);

      const building = {
        room,
        group,
        ringMat,
        doorWorld,
        floorMesh: floor,
        labelSprite: label,
        halfExtent: Math.max(padW, padD) * 0.42,
        enterRadius: 5.5,
        portalUrl: zone.bg,
        npcSprite: null,
      };
      buildings.set(room.id, building);

      const mentorId = ROOM_MENTOR[room.id];
      const portrait = mentorId && Visuals.PORTRAITS[mentorId];
      if (mentorId && portrait) {
        downscaleTexture(portrait, 256).then((tex) => {
          if (!tex) return;
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
          );
          const aspect = tex.image ? tex.image.width / tex.image.height : 0.75;
          sprite.scale.set(2.4 * aspect, 2.4, 1);
          sprite.position.set(0, 2.35, 0);
          sprite.userData = { type: "npc", mentorId, roomId: room.id };
          group.add(sprite);
          building.npcSprite = sprite;
          clickables.push(sprite);
        });
      }
    }

    Object.values(Visuals.MAP_ROOMS).forEach(buildRoom);

    // Circuit traces — axis-aligned routes between room pads (no diagonal criss-cross).
    const circuitSegments = [];
    const drawnSegments = new Map();
    const traceBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1a1428,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    const glowBaseMat = new THREE.MeshBasicMaterial({
      color: 0x5a4888,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });

    function addTraceSegment(x1, z1, x2, z2, roomA, roomB) {
      const key = segmentKey(x1, z1, x2, z2);
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.4) return;
      let rec = drawnSegments.get(key);
      if (!rec) {
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        const alongX = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
        const traceW = 1.05;
        const geo = alongX
          ? new THREE.BoxGeometry(len, 0.025, traceW)
          : new THREE.BoxGeometry(traceW, 0.025, len);
        const traceMat = traceBaseMat.clone();
        const trace = new THREE.Mesh(geo, traceMat);
        trace.position.set(midX, 0.022, midZ);
        trace.receiveShadow = true;
        scene.add(trace);
        const glowMat = glowBaseMat.clone();
        const glowGeo = alongX
          ? new THREE.BoxGeometry(len * 0.96, 0.012, traceW * 0.35)
          : new THREE.BoxGeometry(traceW * 0.35, 0.012, len * 0.96);
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(midX, 0.034, midZ);
        scene.add(glow);
        rec = { traceMat, glowMat, pairs: [], junctions: [key.split("|")[0], key.split("|")[1]] };
        drawnSegments.set(key, rec);
        circuitSegments.push(rec);
      }
      rec.pairs.push([roomA, roomB]);
    }

    Visuals.MAP_EDGES.forEach(([a, b]) => {
      const ra = Visuals.MAP_ROOMS[a];
      const rb = Visuals.MAP_ROOMS[b];
      if (!ra || !rb) return;
      const pa = roomPos(ra);
      const pb = roomPos(rb);
      const padA = Math.max(ra.id === "final_trial" ? 14 : 12, ra.id === "final_trial" ? 13 : 11) * 0.44;
      const padB = Math.max(rb.id === "final_trial" ? 14 : 12, rb.id === "final_trial" ? 13 : 11) * 0.44;
      const segments = routeEdge(pa.x, pa.z, pb.x, pb.z, padA, padB);
      segments.forEach((seg) => addTraceSegment(seg.x1, seg.z1, seg.x2, seg.z2, a, b));
    });

    const junctionPts = new Set();
    drawnSegments.forEach((rec) => rec.junctions.forEach((pt) => junctionPts.add(pt)));
    junctionPts.forEach((pt) => {
      const [x, z] = pt.split(",").map((v) => Number(v) / 4);
      const node = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.03, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2040, emissive: 0x3a2860, emissiveIntensity: 0.4, roughness: 0.7 })
      );
      node.position.set(x, 0.028, z);
      scene.add(node);
    });

    // Floating campus motes.
    const moteCount = 240;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * 170;
      motePos[i * 3 + 1] = 1.5 + Math.random() * 22;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * 170;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        color: 0xc4b0ff,
        size: 0.32,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    scene.add(motes);

    // Objective beacon.
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd54a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
    });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 40, 20, 1, true), beaconMat);
    beacon.visible = false;
    beacon.position.y = 20;
    scene.add(beacon);

    // --- player -------------------------------------------------------------------
    const player = buildMeeplePlayer();
    const playerLight = new THREE.PointLight(0xffd4b0, 0.55, 14);
    playerLight.position.set(0, 1.6, 0.4);
    player.add(playerLight);
    scene.add(player);

    const playerPos = new THREE.Vector3(0, 0, 70);
    let playerYaw = 0;
    let camDist = CAM_DIST;
    const camPos = new THREE.Vector3(0, 40, 140);
    const camTarget = new THREE.Vector3();
    const roamCamPos = new THREE.Vector3();
    const roamCamTarget = new THREE.Vector3();
    const mapCamPos = new THREE.Vector3();
    const mapCamTarget = new THREE.Vector3();
    let mapBlend = 0;

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
    }

    function roamCamera(outPos, outTarget, bob) {
      const backX = -Math.sin(playerYaw) * camDist;
      const backZ = -Math.cos(playerYaw) * camDist;
      outPos.set(playerPos.x + backX, CAM_HEIGHT + bob, playerPos.z + backZ);
      outTarget.set(
        playerPos.x + Math.sin(playerYaw) * 3,
        1.8 + bob,
        playerPos.z + Math.cos(playerYaw) * 3
      );
    }

    function mapCamera(outPos, outTarget, aspect) {
      const h = mapCameraHeight(aspect);
      const focusX = THREE.MathUtils.lerp(playerPos.x, 0, 0.5);
      const focusZ = THREE.MathUtils.lerp(playerPos.z, 0, 0.5);
      outPos.set(focusX, h, focusZ + 0.01);
      outTarget.set(focusX, 0, focusZ);
    }

    // --- interaction / game-state glue -------------------------------------------
    const promptEl = document.getElementById("worldPrompt");
    const promptText = document.getElementById("worldPromptText");
    const hintEl = document.getElementById("worldControlsHint");

    const objectiveEl = document.createElement("div");
    objectiveEl.id = "worldObjective";
    objectiveEl.className = "tt-world-objective dw-hidden";
    root.parentElement?.appendChild(objectiveEl);

    let roam = false;
    let pendingTarget = null; // { nodeId, roomId }
    let playerRoom = "start";
    let gameEverShown = false;

    const visitedSet = () => new Set(bridge.getRunState().visitedRooms);
    const completedSet = () => new Set(bridge.getRunState().completedRooms);

    function movementBlocked() {
      if (mapOpen()) return true;
      if (bridge.isOverlayOpen()) return true;
      if (document.body.classList.contains("tt-in-room")) return true;
      const typingEl = document.getElementById("typingChallenge");
      if (typingEl && !typingEl.classList.contains("dw-hidden") && typingFocused()) return true;
      return false;
    }

    function enterable(roomId) {
      if (!Visuals.MAP_ROOMS[roomId]) return null;
      if (pendingTarget?.roomId === roomId) return "target";
      return "visited";
    }

    function setRoam(on) {
      roam = on;
      document.body.classList.toggle("tt-roam", on);
      document.body.classList.toggle("tt-in-room", !on);
      hintEl?.classList.toggle("dw-hidden", !on);
      if (on) {
        const ae = document.activeElement;
        if (ae && ae !== document.body && ae !== document.documentElement) {
          ae.blur();
        }
        renderer.domElement.focus({ preventScroll: true });
      } else {
        hidePrompt();
      }
      updateObjective();
    }

    setRoam(false);

    function updateObjective() {
      if (!objectiveEl) return;
      if (roam && pendingTarget) {
        const room = Visuals.MAP_ROOMS[pendingTarget.roomId];
        objectiveEl.textContent = `➤ Next: ${room?.icon || ""} ${room?.label || pendingTarget.roomId}`;
        objectiveEl.classList.remove("dw-hidden");
      } else if (roam) {
        objectiveEl.textContent = "Explore the campus — gold-ring doors are open";
        objectiveEl.classList.remove("dw-hidden");
      } else {
        objectiveEl.classList.add("dw-hidden");
      }
    }

    function showPrompt(text) {
      if (!promptEl || !promptText) return;
      promptText.textContent = text;
      promptEl.classList.remove("dw-hidden");
    }
    function hidePrompt() {
      promptEl?.classList.add("dw-hidden");
    }

    let promptAction = null;
    promptEl?.addEventListener("click", () => promptAction?.());

    function doorOf(roomId) {
      return buildings.get(roomId)?.doorWorld || null;
    }

    function teleportToRoomDoor(roomId) {
      const b = buildings.get(roomId);
      if (!b) return;
      const away = b.doorWorld.clone().sub(b.group.position).normalize();
      playerPos.copy(b.doorWorld).addScaledVector(away, 2.2);
      playerPos.y = 0;
      playerYaw = Math.atan2(
        b.group.position.x - playerPos.x,
        b.group.position.z - playerPos.z
      );
      syncPlayerTransform(0);
      playerRoom = roomId;
    }

    function syncPlayerTransform(bob = 0) {
      player.rotation.y = playerYaw;
      player.position.set(playerPos.x, bob, playerPos.z);
    }

    function enterRoom(roomId) {
      const nodeId = bridge.resolveEntryNode?.(roomId, pendingTarget)
        || (pendingTarget?.roomId === roomId ? pendingTarget.nodeId : roomId);
      if (!window.TechTrailStory?.STORY?.[nodeId]) {
        console.error("[GTG] 3D enter: unknown story node", nodeId, "for room", roomId);
        showPrompt("That door is not ready yet — check your mission.");
        return;
      }
      pendingTarget = null;
      beacon.visible = false;
      setRoam(false);
      promptAction = null;
      hidePrompt();
      bridge.navigate(nodeId, { direct: true, skipRhythm: true, fromWorld: true });
    }

    window.__gtgWorld3D.requestWalkTo = (nodeId, roomId) => {
      pendingTarget = { nodeId, roomId };
      setRoam(true);
      updateObjective();
      const b = buildings.get(roomId);
      if (b) beacon.position.set(b.group.position.x, 20, b.group.position.z);
      beacon.visible = true;
      refreshRings();
    };

    window.__gtgWorld3D.enterRoom = enterRoom;
    window.__gtgWorld3D.refreshCampus = refreshRings;

    window.__gtgWorld3D.exitToCampus = () => {
      bridge.closeMap?.();
      const roomId = bridge.mapIdFor(bridge.getRunState().currentNode);
      setRoam(true);
      teleportToRoomDoor(roomId);
      refreshRings();
      updateObjective();
    };

    window.__gtgWorld3D.setCampusRoam = setRoam;

    window.__gtgWorld3D.closeMap = () => bridge.closeMap?.();

    bridge.onSceneRendered((nodeId) => {
      const roomId = bridge.mapIdFor(nodeId);
      if (pendingTarget && pendingTarget.roomId === roomId) {
        pendingTarget = null;
        beacon.visible = false;
      }
      if (roomId !== playerRoom) teleportToRoomDoor(roomId);
      refreshRings();
      updateObjective();
    });

    function refreshRings() {
      const visited = visitedSet();
      const completed = completedSet();
      const completedRooms = new Set(
        [...completed].map((nodeId) => bridge.mapIdFor(nodeId))
      );
      buildings.forEach((b, roomId) => {
        b.ringMat.opacity = 0.85;
        if (pendingTarget?.roomId === roomId) b.ringMat.color.set(0xffd54a);
        else if (completedRooms.has(roomId)) b.ringMat.color.set(0x2dd4bf);
        else if (visited.has(roomId)) b.ringMat.color.set(0x1f8f83);
        else if (enterable(roomId)) b.ringMat.color.set(0xb98a1e);
        else b.ringMat.color.set(0x4a3d63);
      });
      circuitSegments.forEach(({ pairs, traceMat, glowMat }) => {
        let level = 0;
        pairs.forEach(([roomA, roomB]) => {
          const doneA = completedRooms.has(roomA);
          const doneB = completedRooms.has(roomB);
          if (doneA && doneB) level = 2;
          else if ((doneA || doneB) && level < 2) level = 1;
        });
        if (level === 2) {
          glowMat.color.set(0x44ffcc);
          glowMat.opacity = 0.82;
          traceMat.color.set(0x1a6058);
          traceMat.emissive.set(0x22aa88);
          traceMat.emissiveIntensity = 0.35;
          traceMat.opacity = 0.92;
        } else if (level === 1) {
          glowMat.color.set(0x9d8cff);
          glowMat.opacity = 0.42;
          traceMat.color.set(0x2a2048);
          traceMat.emissive.set(0x4433aa);
          traceMat.emissiveIntensity = 0.15;
          traceMat.opacity = 0.68;
        } else {
          glowMat.color.set(0x5a4888);
          glowMat.opacity = 0.1;
          traceMat.color.set(0x1a1428);
          traceMat.emissive.set(0x000000);
          traceMat.emissiveIntensity = 0;
          traceMat.opacity = 0.45;
        }
      });
    }

    // --- mentors (placed per room in buildRoom) ------------------------------------

    // --- input ----------------------------------------------------------------------
    const keys = new Set();
    const typingFocused = () => {
      const el = document.activeElement;
      return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const mapOpen = () => document.body.classList.contains("tt-map-open");

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    renderer.domElement.addEventListener("pointerdown", (e) => {
      if (bridge.isOverlayOpen() || typingFocused()) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const npcHits = raycaster.intersectObjects(clickables, true);
      if (npcHits.length) {
        const data = npcHits[0].object.userData;
        if (data?.type === "npc") {
          bridge.showNpcDialog?.(data.mentorId, data.roomId);
          return;
        }
      }

      if (!mapOpen()) return;
      const floors = [...buildings.values()].map((b) => b.floorMesh).filter(Boolean);
      const floorHits = raycaster.intersectObjects(floors, true);
      if (floorHits.length) {
        const roomId = floorHits[0].object.userData?.roomId;
        if (roomId) {
          teleportToRoomDoor(roomId);
          player.position.copy(playerPos);
          bridge.closeMap?.();
        }
      }
    });

    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k === "e" && !movementBlocked() && promptAction) {
        e.preventDefault();
        promptAction();
        return;
      }
      if (movementBlocked()) return;
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        keys.add(k);
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());

    renderer.domElement.addEventListener("wheel", (e) => {
      if (movementBlocked()) return;
      camDist = Math.min(14, Math.max(5.5, camDist + e.deltaY * 0.01));
    }, { passive: true });

    // Touch: left half = move, right half = turn.
    let joyId = null;
    const joyStart = { x: 0, y: 0 };
    const joyVec = { x: 0, y: 0 };
    let turnId = null;
    const turnLast = { x: 0, y: 0 };
    let turnDelta = 0;
    renderer.domElement.addEventListener("touchstart", (e) => {
      if (movementBlocked()) return;
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && joyId === null) {
          joyId = t.identifier;
          joyStart.x = t.clientX;
          joyStart.y = t.clientY;
        } else if (turnId === null) {
          turnId = t.identifier;
          turnLast.x = t.clientX;
        }
      }
    }, { passive: true });
    renderer.domElement.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyVec.x = Math.max(-1, Math.min(1, (t.clientX - joyStart.x) / 60));
          joyVec.y = Math.max(-1, Math.min(1, (t.clientY - joyStart.y) / 60));
        } else if (t.identifier === turnId) {
          turnDelta += (t.clientX - turnLast.x) * 0.004;
          turnLast.x = t.clientX;
        }
      }
    }, { passive: true });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) { joyId = null; joyVec.x = 0; joyVec.y = 0; }
        if (t.identifier === turnId) turnId = null;
      }
    };
    renderer.domElement.addEventListener("touchend", endTouch, { passive: true });
    renderer.domElement.addEventListener("touchcancel", endTouch, { passive: true });

    // --- movement & collision --------------------------------------------------------
    function movePlayer(dt) {
      if (keys.has("a") || keys.has("arrowleft")) playerYaw += TURN_SPEED * dt;
      if (keys.has("d") || keys.has("arrowright")) playerYaw -= TURN_SPEED * dt;
      if (turnDelta) {
        playerYaw -= turnDelta;
        turnDelta = 0;
      }

      let forward = 0;
      let strafe = 0;
      if (keys.has("w") || keys.has("arrowup")) forward += 1;
      if (keys.has("s") || keys.has("arrowdown")) forward -= 1;
      strafe += joyVec.x;
      forward -= joyVec.y;

      const sin = Math.sin(playerYaw);
      const cos = Math.cos(playerYaw);
      const speed = keys.has("shift") ? RUN_SPEED : WALK_SPEED;
      const dx = (forward * sin + strafe * cos) * speed * dt;
      const dz = (forward * cos - strafe * sin) * speed * dt;
      const mag = Math.hypot(dx, dz);
      const bob = (!reducedMotion() && mag >= 0.0005)
        ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.08
        : 0;
      if (mag < 0.0005) {
        syncPlayerTransform(bob);
        return;
      }
      playerPos.x += dx;
      playerPos.z += dz;
      playerPos.x = Math.max(-WORLD_HALF_X - 6, Math.min(WORLD_HALF_X + 6, playerPos.x));
      playerPos.z = Math.max(-WORLD_HALF_Z - 6, Math.min(WORLD_HALF_Z + 6, playerPos.z));

      syncPlayerTransform(bob);
    }

    // --- proximity / prompts -----------------------------------------------------------
    function checkProximity() {
      if (movementBlocked()) return;
      let best = null;
      let bestD = Infinity;
      buildings.forEach((b, roomId) => {
        const d = Math.hypot(
          playerPos.x - b.group.position.x,
          playerPos.z - b.group.position.z
        );
        if (d < (b.enterRadius || 5.5) && d < bestD) {
          bestD = d;
          best = roomId;
        }
      });
      if (!best) {
        hidePrompt();
        promptAction = null;
        return;
      }
      const room = Visuals.MAP_ROOMS[best];
      const status = enterable(best);
      if (status) {
        showPrompt(`Enter ${room.icon} ${room.label} — press E`);
        promptAction = () => enterRoom(best);
      } else {
        showPrompt(`${room.icon} ${room.label}`);
        promptAction = null;
      }
    }

    // --- fog ambience -------------------------------------------------------------------
    const fogTarget = new THREE.Color(0x1a1028);
    function updateFog(dt) {
      let nearest = null;
      let nd = Infinity;
      buildings.forEach((b) => {
        const d = Math.hypot(playerPos.x - b.group.position.x, playerPos.z - b.group.position.z);
        if (d < nd) { nd = d; nearest = b; }
      });
      if (nearest) {
        const zoneKey = Visuals.NODE_ZONE?.[nearest.room.id] || "dragons";
        fogTarget.lerp(parseTint(Visuals.ZONES[zoneKey]?.tint), 0.05);
      }
      scene.fog.color.lerp(fogTarget, Math.min(1, dt * 2));
    }

    // --- camera --------------------------------------------------------------------------
    function mapCameraHeight(aspect) {
      const spanX = WORLD_HALF_X * 2;
      const spanZ = WORLD_HALF_Z * 2;
      const fovRad = THREE.MathUtils.degToRad(camera.fov);
      const distV = spanZ / (2 * Math.tan(fovRad / 2));
      const distH = spanX / (2 * Math.tan(fovRad / 2) * Math.max(aspect, 0.55));
      return Math.max(distV, distH) * 1.14;
    }

    let mapFogDensity = 0.0042;
    function updateCamera(dt) {
      const mapWanted = mapOpen() ? 1 : 0;
      const blendSpeed = reducedMotion() ? 14 : 2.6;
      mapBlend = THREE.MathUtils.lerp(mapBlend, mapWanted, Math.min(1, dt * blendSpeed));
      const t = easeInOutCubic(mapBlend);

      const still = reducedMotion();
      const bob = still ? 0 : Math.sin(performance.now() * 0.0011) * 0.12;
      roamCamera(roamCamPos, roamCamTarget, bob);
      mapCamera(mapCamPos, mapCamTarget, camera.aspect || 1);

      camPos.copy(roamCamPos).lerp(mapCamPos, t);
      camTarget.copy(roamCamTarget).lerp(mapCamTarget, t);

      // Crane arc: rise above the straight-line path mid-transition.
      if (t > 0.02 && t < 0.98) {
        camPos.y += Math.sin(t * Math.PI) * 14;
      }

      camera.position.copy(camPos);
      camera.lookAt(camTarget);

      mapFogDensity = THREE.MathUtils.lerp(0.0042, 0, t);
      if (scene.fog?.density != null) scene.fog.density = mapFogDensity;
    }

    // --- adaptive pixel ratio ---------------------------------------------------------------
    let slowFrames = 0;
    let degraded = false;
    function watchPerf(dt) {
      if (degraded) return;
      slowFrames = dt > 0.034 ? slowFrames + 1 : 0;
      if (slowFrames > 45) {
        degraded = true;
        renderer.setPixelRatio(1);
      }
    }

    // --- resize ------------------------------------------------------------------------------
    let lastW = 0;
    let lastH = 0;
    function resize() {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (w < 2 || h < 2) return;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.__gtgWorld3D.resize = resize;
    window.addEventListener("resize", resize);
    resize();

    // --- spawn when game view first shows ------------------------------------------------------
    function ensureSpawn() {
      if (!bridge.isViewActive("game")) return;
      resize();
      if (gameEverShown) return;
      gameEverShown = true;
      teleportToRoomDoor(bridge.mapIdFor(bridge.getRunState().currentNode));
      refreshRings();
    }

    window.__gtgWorld3D.ready = true;

    // --- main loop -------------------------------------------------------------------------------
    const clock = new THREE.Clock();
    let promptTick = 0;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      ensureSpawn();
      if (!movementBlocked()) movePlayer(dt);
      promptTick += dt;
      if (promptTick > 0.15) {
        promptTick = 0;
        checkProximity();
      }
      updateCamera(dt);
      updateFog(dt);
      watchPerf(dt);
      if (beacon.visible) {
        beaconMat.opacity = reducedMotion() ? 0.22 : 0.16 + Math.sin(performance.now() * 0.004) * 0.08;
        beacon.rotation.y += dt * 0.6;
      }
      if (pendingTarget) {
        const b = buildings.get(pendingTarget.roomId);
        if (b && !reducedMotion()) b.ringMat.opacity = 0.6 + Math.sin(performance.now() * 0.006) * 0.35;
      }
      if (!reducedMotion()) {
        const t = performance.now() * 0.001;
        motes.rotation.y += dt * 0.015;
      }
      const map = mapOpen();
      buildings.forEach((b) => {
        if (b.labelSprite) b.labelSprite.visible = map;
        if (b.npcSprite) {
          b.npcSprite.material.opacity = map ? 1 : 0.95;
        }
      });
      renderer.render(scene, camera);
    });
  }

  try {
    boot();
  } catch (err) {
    console.error("[GTG] 3D world failed to start; falling back to flat mode.", err);
    document.body.classList.add("tt-flat");
    if (window.__gtgWorld3D) window.__gtgWorld3D.active = false;
  }

  if (!window.__gtgWorld3D?.ready) {
    window.addEventListener("load", () => {
      if (window.__gtgWorld3D?.ready) return;
      if (!window.TechTrailWorld) return;
      try {
        boot();
      } catch (err) {
        console.error("[GTG] 3D world retry failed.", err);
        document.body.classList.add("tt-flat");
      }
    }, { once: true });
  }
})();
