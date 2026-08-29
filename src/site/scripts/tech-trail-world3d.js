/**
 * DaVinci Dragons — 3D campus world (Three.js).
 * ES module; reads window.TechTrailVisuals and calls app.js through window.TechTrailWorld.
 * If WebGL is unavailable or anything fails during boot, the world never activates
 * and the flat game is untouched.
 */
import * as THREE from "three";

(() => {
  const WORLD_HALF_X = 88;
  const WORLD_HALF_Z = 80;
  const WALK_SPEED = 6.5;
  const RUN_SPEED = 11;
  const DOOR_REACH = 3.4;
  const PLAYER_RADIUS = 0.55;

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
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#15101f";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(146, 108, 255, 0.10)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function boot() {
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

    window.__gtgWorld3D = { active: true, requestWalkTo: null, enterRoom: null };

    // --- renderer / scene basics -------------------------------------------------
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    root.appendChild(renderer.domElement);
    renderer.domElement.classList.add("tt-world__canvas");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x140818);
    scene.fog = new THREE.Fog(0x241533, 60, 220);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);

    scene.add(new THREE.HemisphereLight(0x9d8cff, 0x1a0f24, 1.15));
    const sun = new THREE.DirectionalLight(0xffd9a0, 1.05);
    sun.position.set(60, 90, 40);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshLambertMaterial({ map: groundTexture(), color: 0xffffff })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

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

    function buildRoom(room) {
      const { x, z } = roomPos(room);
      const zoneKey = Visuals.NODE_ZONE?.[room.id] || "dragons";
      const zone = Visuals.ZONES[zoneKey] || Visuals.ZONES.dragons;
      const color = parseTint(zone.tint);
      const golden = GOLDEN_ROOMS.has(room.id);

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const toCenter = Math.atan2(-x, -z); // yaw facing campus center
      group.rotation.y = toCenter;

      let seed = 0;
      for (const ch of room.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const h = 5 + (seed % 4);

      const bodyMat = new THREE.MeshLambertMaterial({
        color: color.clone().multiplyScalar(0.85).lerp(new THREE.Color(0x2a2040), 0.35),
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(9, h, 9), bodyMat);
      body.position.y = h / 2;
      group.add(body);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(7.2, 3, 4),
        new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.55) })
      );
      roof.position.y = h + 1.5;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);

      if (golden) {
        const trim = new THREE.Mesh(
          new THREE.TorusGeometry(5.2, 0.18, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0xffd54a })
        );
        trim.rotation.x = Math.PI / 2;
        trim.position.y = h + 0.4;
        group.add(trim);
      }

      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 3.4),
        new THREE.MeshBasicMaterial({ color: 0x120a1e })
      );
      door.position.set(0, 1.7, 4.51);
      group.add(door);

      const label = textSprite(`${room.icon} ${room.label}`);
      label.position.y = h + 5;
      group.add(label);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x4a3d63, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(6.4, 7.1, 40), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);

      scene.add(group);

      const doorDir = new THREE.Vector3(Math.sin(toCenter), 0, Math.cos(toCenter));
      const doorWorld = new THREE.Vector3(x, 0, z).addScaledVector(doorDir, 5.2);

      buildings.set(room.id, {
        room,
        group,
        ringMat,
        doorWorld,
        halfExtent: 5.2,
        door,
        portalLoaded: false,
        portalUrl: zone.bg,
      });
    }

    Object.values(Visuals.MAP_ROOMS).forEach(buildRoom);

    // Path ribbons along edges.
    const pathMat = new THREE.MeshBasicMaterial({ color: 0x352a52, transparent: true, opacity: 0.55 });
    Visuals.MAP_EDGES.forEach(([a, b]) => {
      const ra = Visuals.MAP_ROOMS[a];
      const rb = Visuals.MAP_ROOMS[b];
      if (!ra || !rb) return;
      const pa = roomPos(ra);
      const pb = roomPos(rb);
      const dx = pb.x - pa.x;
      const dz = pb.z - pa.z;
      const len = Math.hypot(dx, dz) - 13;
      if (len <= 1) return;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.7, len), pathMat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = -Math.atan2(dx, dz);
      strip.position.set((pa.x + pb.x) / 2, 0.03, (pa.z + pb.z) / 2);
      scene.add(strip);
    });

    // Objective beacon.
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd54a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
    });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 40, 20, 1, true), beaconMat);
    beacon.visible = false;
    beacon.position.y = 20;
    scene.add(beacon);

    // --- player -------------------------------------------------------------------
    const player = new THREE.Group();
    const playerBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(PLAYER_RADIUS, 1.0, 4, 12),
      new THREE.MeshLambertMaterial({ color: 0xc41e3a })
    );
    playerBody.position.y = 1.05;
    player.add(playerBody);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x7ef0ff })
    );
    visor.position.set(0, 1.5, PLAYER_RADIUS - 0.05);
    player.add(visor);
    scene.add(player);

    const playerPos = new THREE.Vector3(0, 0, 70);
    let camYaw = 0; // camera south of player, looking toward campus center
    let camPitch = 0.42;
    let camDist = 10;
    const camPos = new THREE.Vector3(0, 40, 140);
    const camTarget = new THREE.Vector3();

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

    function enterable(roomId) {
      const visited = visitedSet();
      if (pendingTarget?.roomId === roomId) return "target";
      if (visited.has(roomId)) return "visited";
      for (const v of visited) {
        if ((neighborsOf[v] || []).includes(roomId)) return "neighbor";
      }
      return null;
    }

    function setRoam(on) {
      roam = on;
      document.body.classList.toggle("tt-roam", on);
      hintEl?.classList.toggle("dw-hidden", !on);
      if (!on) hidePrompt();
      updateObjective();
    }

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
      if (!promptEl) return;
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
      camYaw = Math.atan2(-playerPos.x, -playerPos.z) + Math.PI;
      playerRoom = roomId;
    }

    function enterRoom(roomId) {
      const nodeId = pendingTarget?.roomId === roomId ? pendingTarget.nodeId : roomId;
      pendingTarget = null;
      beacon.visible = false;
      setRoam(false);
      bridge.navigate(nodeId, { direct: true, skipRhythm: true });
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
      buildings.forEach((b, roomId) => {
        b.ringMat.opacity = 0.85;
        if (pendingTarget?.roomId === roomId) b.ringMat.color.set(0xffd54a);
        else if (completed.has(roomId)) b.ringMat.color.set(0x2dd4bf);
        else if (visited.has(roomId)) b.ringMat.color.set(0x1f8f83);
        else if (enterable(roomId)) b.ringMat.color.set(0xb98a1e);
        else b.ringMat.color.set(0x4a3d63);
      });
    }

    // --- mentors -------------------------------------------------------------------
    const mentorsByRoom = {};
    Object.entries(MENTOR_ROOMS).forEach(([mentor, roomId]) => {
      (mentorsByRoom[roomId] = mentorsByRoom[roomId] || []).push(mentor);
    });
    Object.entries(mentorsByRoom).forEach(([roomId, mentors], ) => {
      const b = buildings.get(roomId);
      if (!b) return;
      mentors.forEach((mentor, i) => {
        const url = Visuals.PORTRAITS[mentor];
        if (!url) return;
        downscaleTexture(url, 256).then((tex) => {
          if (!tex) return;
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
          );
          const aspect = tex.image ? tex.image.width / tex.image.height : 0.75;
          sprite.scale.set(2.6 * aspect, 2.6, 1);
          const angle = (i + 1) * 1.15;
          sprite.position.set(
            b.group.position.x + Math.sin(angle) * 7.5,
            2.2,
            b.group.position.z + Math.cos(angle) * 7.5
          );
          scene.add(sprite);
        });
      });
    });

    // Door portal textures (zone scene PNGs, downscaled).
    const portalCache = new Map();
    buildings.forEach((b) => {
      if (portalCache.has(b.portalUrl)) {
        const pending = portalCache.get(b.portalUrl);
        pending.then((tex) => { if (tex) { b.door.material.map = tex; b.door.material.color.set(0xffffff); b.door.material.needsUpdate = true; } });
        return;
      }
      const pending = downscaleTexture(b.portalUrl, 512);
      portalCache.set(b.portalUrl, pending);
      pending.then((tex) => { if (tex) { b.door.material.map = tex; b.door.material.color.set(0xffffff); b.door.material.needsUpdate = true; } });
    });

    // --- input ----------------------------------------------------------------------
    const keys = new Set();
    const typingFocused = () => {
      const el = document.activeElement;
      return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const mapOpen = () => !document.getElementById("campusMap")?.classList.contains("dw-hidden");

    window.addEventListener("keydown", (e) => {
      if (!roam || typingFocused() || bridge.isOverlayOpen() || mapOpen()) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        keys.add(k);
        e.preventDefault();
      }
      if (k === "e" && promptAction) {
        e.preventDefault();
        promptAction();
      }
    });
    window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());

    // Click-drag orbit (mouse), wheel zoom.
    let dragging = false;
    let lastPX = 0;
    let lastPY = 0;
    renderer.domElement.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      dragging = true;
      lastPX = e.clientX;
      lastPY = e.clientY;
    });
    window.addEventListener("pointerup", () => { dragging = false; });
    window.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerType === "touch") return;
      camYaw -= (e.clientX - lastPX) * 0.005;
      camPitch = Math.min(1.15, Math.max(0.12, camPitch + (e.clientY - lastPY) * 0.004));
      lastPX = e.clientX;
      lastPY = e.clientY;
    });
    renderer.domElement.addEventListener("wheel", (e) => {
      if (!roam) return;
      camDist = Math.min(16, Math.max(6, camDist + e.deltaY * 0.01));
    }, { passive: true });

    // Touch: left half = joystick, right half = orbit drag.
    let joyId = null;
    const joyStart = { x: 0, y: 0 };
    const joyVec = { x: 0, y: 0 };
    let orbitId = null;
    const orbitLast = { x: 0, y: 0 };
    renderer.domElement.addEventListener("touchstart", (e) => {
      if (!roam) return;
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && joyId === null) {
          joyId = t.identifier;
          joyStart.x = t.clientX;
          joyStart.y = t.clientY;
        } else if (orbitId === null) {
          orbitId = t.identifier;
          orbitLast.x = t.clientX;
          orbitLast.y = t.clientY;
        }
      }
    }, { passive: true });
    renderer.domElement.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyVec.x = Math.max(-1, Math.min(1, (t.clientX - joyStart.x) / 60));
          joyVec.y = Math.max(-1, Math.min(1, (t.clientY - joyStart.y) / 60));
        } else if (t.identifier === orbitId) {
          camYaw -= (t.clientX - orbitLast.x) * 0.006;
          camPitch = Math.min(1.15, Math.max(0.12, camPitch + (t.clientY - orbitLast.y) * 0.005));
          orbitLast.x = t.clientX;
          orbitLast.y = t.clientY;
        }
      }
    }, { passive: true });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) { joyId = null; joyVec.x = 0; joyVec.y = 0; }
        if (t.identifier === orbitId) orbitId = null;
      }
    };
    renderer.domElement.addEventListener("touchend", endTouch, { passive: true });
    renderer.domElement.addEventListener("touchcancel", endTouch, { passive: true });

    // --- movement & collision --------------------------------------------------------
    function movePlayer(dt) {
      let ix = 0;
      let iz = 0;
      if (keys.has("w") || keys.has("arrowup")) iz -= 1;
      if (keys.has("s") || keys.has("arrowdown")) iz += 1;
      if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
      if (keys.has("d") || keys.has("arrowright")) ix += 1;
      ix += joyVec.x;
      iz += joyVec.y;
      const mag = Math.hypot(ix, iz);
      if (mag < 0.05) {
        playerBody.position.y = 1.05;
        return;
      }
      ix /= Math.max(1, mag);
      iz /= Math.max(1, mag);
      const speed = keys.has("shift") ? RUN_SPEED : WALK_SPEED;
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const dx = (ix * cos + iz * sin) * speed * dt;
      const dz = (iz * cos - ix * sin) * speed * dt;
      playerPos.x += dx;
      playerPos.z += dz;
      playerPos.x = Math.max(-WORLD_HALF_X - 6, Math.min(WORLD_HALF_X + 6, playerPos.x));
      playerPos.z = Math.max(-WORLD_HALF_Z - 6, Math.min(WORLD_HALF_Z + 6, playerPos.z));

      // Circle vs building AABB push-out.
      buildings.forEach((b) => {
        const bx = b.group.position.x;
        const bz = b.group.position.z;
        const he = b.halfExtent;
        const cx = Math.max(bx - he, Math.min(bx + he, playerPos.x));
        const cz = Math.max(bz - he, Math.min(bz + he, playerPos.z));
        const ddx = playerPos.x - cx;
        const ddz = playerPos.z - cz;
        const d = Math.hypot(ddx, ddz);
        if (d < PLAYER_RADIUS && d > 0.0001) {
          playerPos.x = cx + (ddx / d) * PLAYER_RADIUS;
          playerPos.z = cz + (ddz / d) * PLAYER_RADIUS;
        } else if (d <= 0.0001) {
          playerPos.x = bx + he + PLAYER_RADIUS; // degenerate: push east
        }
      });

      player.rotation.y = Math.atan2(dx, dz);
      if (!reducedMotion()) {
        playerBody.position.y = 1.05 + Math.abs(Math.sin(performance.now() * 0.012)) * 0.12;
      }
      player.position.copy(playerPos);
    }

    // --- proximity / prompts -----------------------------------------------------------
    function checkProximity() {
      if (!roam) return;
      let best = null;
      let bestD = DOOR_REACH;
      buildings.forEach((b, roomId) => {
        const d = Math.hypot(playerPos.x - b.doorWorld.x, playerPos.z - b.doorWorld.z);
        if (d < bestD) {
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
        showPrompt(`Enter ${room.icon} ${room.label}`);
        promptAction = () => enterRoom(best);
      } else {
        showPrompt(`${room.icon} ${room.label} — locked. Follow your mission.`);
        promptAction = null;
      }
    }

    // --- fog ambience -------------------------------------------------------------------
    const fogTarget = new THREE.Color(0x241533);
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
    function updateCamera(dt) {
      const map = mapOpen();
      let desired;
      if (map) {
        desired = new THREE.Vector3(0, 130, 155);
        camTarget.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 3));
      } else {
        const still = reducedMotion();
        const bob = still ? 0 : Math.sin(performance.now() * 0.0011) * 0.15;
        const off = new THREE.Vector3(
          Math.sin(camYaw) * Math.cos(camPitch),
          Math.sin(camPitch),
          Math.cos(camYaw) * Math.cos(camPitch)
        ).multiplyScalar(camDist);
        desired = playerPos.clone().add(off).add(new THREE.Vector3(0, 2.4 + bob, 0));
        camTarget.lerp(playerPos.clone().add(new THREE.Vector3(0, 2, 0)), Math.min(1, dt * 6));
      }
      camPos.lerp(desired, Math.min(1, dt * (map ? 1.6 : 8)));
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
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
    function resize() {
      const w = root.clientWidth || 1;
      const h = root.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();

    // --- spawn when game view first shows ------------------------------------------------------
    function ensureSpawn() {
      if (gameEverShown || !bridge.isViewActive("game")) return;
      gameEverShown = true;
      teleportToRoomDoor(bridge.mapIdFor(bridge.getRunState().currentNode));
      refreshRings();
    }

    // --- main loop -------------------------------------------------------------------------------
    const clock = new THREE.Clock();
    let promptTick = 0;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      ensureSpawn();
      if (roam && !bridge.isOverlayOpen() && !mapOpen()) movePlayer(dt);
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
})();
