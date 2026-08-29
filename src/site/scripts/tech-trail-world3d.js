/**
 * DaVinci Dragons — 3D campus world (Three.js).
 * ES module; reads window.TechTrailVisuals and calls app.js through window.TechTrailWorld.
 * If WebGL is unavailable or anything fails during boot, the world never activates
 * and the flat game is untouched.
 */
import * as THREE from "three";
import { decorateRoom, roomSilhouette, makeRoomFloorTexture } from "./tech-trail-world3d-props.js";

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
    const g = ctx.createRadialGradient(256, 256, 40, 256, 256, 280);
    g.addColorStop(0, "#1c1528");
    g.addColorStop(1, "#0e0a16");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(146, 108, 255, 0.14)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = `rgba(157, 140, 255, ${0.03 + Math.random() * 0.05})`;
      ctx.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
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
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(padW, padD),
        new THREE.MeshStandardMaterial({
          map: floorTex,
          color: 0xffffff,
          roughness: 0.82,
          metalness: 0.08,
        })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.05;
      floor.receiveShadow = true;
      floor.userData = { type: "floor", roomId: room.id };
      group.add(floor);

      const border = new THREE.Mesh(
        new THREE.RingGeometry(Math.min(padW, padD) * 0.46, Math.min(padW, padD) * 0.5, 48),
        new THREE.MeshBasicMaterial({ color: trimColor, transparent: true, opacity: golden ? 0.9 : 0.55 })
      );
      border.rotation.x = -Math.PI / 2;
      border.position.y = 0.07;
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
      }

      decorateRoom(room.id, group, padH, color);

      const label = textSprite(`${room.icon} ${room.label}`);
      label.position.y = 4.2;
      label.visible = false;
      group.add(label);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x4a3d63, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(5.8, 6.5, 40), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
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

    // Path ribbons along edges.
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x2a2240,
      roughness: 0.88,
      metalness: 0.06,
      transparent: true,
      opacity: 0.72,
    });
    const pathGlowMat = new THREE.MeshBasicMaterial({
      color: 0x9d8cff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
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
      const rotZ = -Math.atan2(dx, dz);
      const midX = (pa.x + pb.x) / 2;
      const midZ = (pa.z + pb.z) / 2;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.9, len), pathMat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = rotZ;
      strip.position.set(midX, 0.03, midZ);
      strip.receiveShadow = true;
      scene.add(strip);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.35, len * 0.92), pathGlowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.rotation.z = rotZ;
      glow.position.set(midX, 0.05, midZ);
      scene.add(glow);
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
    const player = new THREE.Group();
    const playerBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(PLAYER_RADIUS, 1.0, 4, 12),
      stdMat(0xc41e3a, { roughness: 0.55, metalness: 0.08 })
    );
    playerBody.position.y = 1.05;
    playerBody.castShadow = true;
    player.add(playerBody);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x7ef0ff,
        emissive: 0x44c8e8,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.35,
      })
    );
    visor.position.set(0, 1.5, PLAYER_RADIUS - 0.05);
    player.add(visor);
    const playerLight = new THREE.PointLight(0xffd4b0, 0.55, 14);
    playerLight.position.set(0, 2.2, 0.4);
    player.add(playerLight);
    scene.add(player);

    const playerPos = new THREE.Vector3(0, 0, 70);
    let playerYaw = 0;
    let camDist = CAM_DIST;
    const camPos = new THREE.Vector3(0, 40, 140);
    const camTarget = new THREE.Vector3();
    const camDesired = new THREE.Vector3();

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
      if (!Visuals.MAP_ROOMS[roomId]) return null;
      if (pendingTarget?.roomId === roomId) return "target";
      return "visited";
    }

    function setRoam(on) {
      roam = on;
      document.body.classList.toggle("tt-roam", on);
      hintEl?.classList.toggle("dw-hidden", !on);
      if (on) {
        const ae = document.activeElement;
        if (ae && ae !== document.body && ae !== document.documentElement) {
          ae.blur();
        }
      } else {
        hidePrompt();
      }
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
      player.rotation.y = playerYaw;
      playerRoom = roomId;
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

    window.__gtgWorld3D.exitToCampus = () => {
      const roomId = bridge.mapIdFor(bridge.getRunState().currentNode);
      setRoam(true);
      teleportToRoomDoor(roomId);
      refreshRings();
      updateObjective();
    };

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
      if (k === "e" && roam && promptAction && !bridge.isOverlayOpen() && !mapOpen()) {
        e.preventDefault();
        promptAction();
        return;
      }
      if (!roam || typingFocused() || bridge.isOverlayOpen() || mapOpen()) return;
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        keys.add(k);
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());

    renderer.domElement.addEventListener("wheel", (e) => {
      if (!roam) return;
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
      if (!roam) return;
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
      if (mag < 0.0005) {
        playerBody.position.y = 1.05;
        player.rotation.y = playerYaw;
        return;
      }
      playerPos.x += dx;
      playerPos.z += dz;
      playerPos.x = Math.max(-WORLD_HALF_X - 6, Math.min(WORLD_HALF_X + 6, playerPos.x));
      playerPos.z = Math.max(-WORLD_HALF_Z - 6, Math.min(WORLD_HALF_Z + 6, playerPos.z));

      player.rotation.y = playerYaw;
      if (!reducedMotion()) {
        playerBody.position.y = 1.05 + Math.abs(Math.sin(performance.now() * 0.012)) * 0.12;
      }
      player.position.copy(playerPos);
    }

    // --- proximity / prompts -----------------------------------------------------------
    function checkProximity() {
      if (!roam) return;
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
      const map = mapOpen();
      if (map) {
        const h = mapCameraHeight(camera.aspect || 1);
        camDesired.set(0, h, 0);
        camTarget.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 4));
        mapFogDensity = THREE.MathUtils.lerp(mapFogDensity, 0.0016, Math.min(1, dt * 5));
      } else {
        mapFogDensity = THREE.MathUtils.lerp(mapFogDensity, 0.0042, Math.min(1, dt * 5));
        const still = reducedMotion();
        const bob = still ? 0 : Math.sin(performance.now() * 0.0011) * 0.12;
        const backX = -Math.sin(playerYaw) * camDist;
        const backZ = -Math.cos(playerYaw) * camDist;
        camDesired.set(
          playerPos.x + backX,
          CAM_HEIGHT + bob,
          playerPos.z + backZ
        );
        const lookX = playerPos.x + Math.sin(playerYaw) * 3;
        const lookZ = playerPos.z + Math.cos(playerYaw) * 3;
        camTarget.lerp(new THREE.Vector3(lookX, 1.8 + bob, lookZ), Math.min(1, dt * 10));
      }
      if (scene.fog?.density != null) scene.fog.density = mapFogDensity;
      camPos.lerp(camDesired, Math.min(1, dt * (map ? 1.6 : 9)));
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
