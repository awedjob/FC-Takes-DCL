import {
  ColliderLayer,
  engine,
  Entity,
  Material,
  MaterialTransparencyMode,
  MeshCollider,
  MeshRenderer,
  Transform,
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

// Disc size range confirmed in-world:
//   Smallest ≈ 0.70m diameter (radius 0.35)
//   Largest  ≈ 2.35m diameter (radius 1.175)

type OrbitState = {
  entity: Entity
  cx: number; cy: number; cz: number
  rx: number; rz: number
  orbitSpeed: number; orbitPhase: number
  radius: number; color: Color3
  visible: boolean
  timer: number
  visibleDuration: number; hiddenDuration: number
  t: number
}

type CrossState = {
  entity: Entity
  start: Vector3; end: Vector3
  speed: number
  minSpeed: number; maxSpeed: number
  radius: number; color: Color3
  visible: boolean
  respawnDelay: number
  timer: number
  progress: number
}

const orbitStates: OrbitState[] = []
const crossStates: CrossState[] = []

// Full jump path: x=-17 (arch top) → x=20 (far edge of target box)
// Full width: z=17 → z=47
const BOX_X_MIN = -17
const BOX_X_MAX =  20
const BOX_Z_MIN =  17
const BOX_Z_MAX =  47

export function createObstacles() {
  // ── Orbiting discs (5) ───────────────────────────────────────────────────
  const orbitDefs = [
    // Original 5
    { cx: 8, cy: 38, cz: 32, rx: 5.5, rz: 3.0, orbitSpeed: 0.60, orbitPhase: 0,               radius: 1.00,  color: Color3.create(0.5, 0.1, 0.9), vis: 4.0, hid: 2.5 },
    { cx: 8, cy: 28, cz: 32, rx: 2.5, rz: 5.5, orbitSpeed: 0.85, orbitPhase: Math.PI * 0.50,  radius: 0.35,  color: Color3.create(0.9, 0.2, 0.4), vis: 3.5, hid: 1.8 },
    { cx: 8, cy: 19, cz: 32, rx: 6.0, rz: 4.0, orbitSpeed: 0.50, orbitPhase: Math.PI,         radius: 1.175, color: Color3.create(0.1, 0.6, 0.9), vis: 5.0, hid: 3.0 },
    { cx: 8, cy: 11, cz: 32, rx: 4.0, rz: 5.0, orbitSpeed: 1.10, orbitPhase: Math.PI * 1.50,  radius: 0.55,  color: Color3.create(0.9, 0.6, 0.1), vis: 2.5, hid: 2.0 },
    { cx: 8, cy:  4, cz: 32, rx: 3.5, rz: 2.5, orbitSpeed: 1.40, orbitPhase: Math.PI * 0.75,  radius: 0.80,  color: Color3.create(0.2, 0.9, 0.4), vis: 3.0, hid: 1.5 },
    // Option 1: tight center guards
    { cx: 8, cy: 1.5, cz: 32, rx: 1.0, rz: 1.0, orbitSpeed: 1.8,  orbitPhase: 0,              radius: 0.80,  color: Color3.create(1.0, 1.0, 1.0), vis: 3.5, hid: 1.0 },
    { cx: 8, cy: 2.5, cz: 32, rx: 1.2, rz: 1.2, orbitSpeed: 2.4,  orbitPhase: Math.PI * 0.33, radius: 0.55,  color: Color3.create(0.8, 1.0, 1.0), vis: 3.2, hid: 0.9 },
    { cx: 8, cy: 3.5, cz: 32, rx: 1.5, rz: 1.5, orbitSpeed: 2.2,  orbitPhase: Math.PI * 0.66, radius: 0.60,  color: Color3.create(1.0, 1.0, 0.2), vis: 4.0, hid: 1.2 },
    { cx: 8, cy: 4.5, cz: 32, rx: 1.8, rz: 1.8, orbitSpeed: 1.6,  orbitPhase: Math.PI * 1.00, radius: 0.75,  color: Color3.create(1.0, 0.8, 0.1), vis: 3.8, hid: 1.0 },
    { cx: 8, cy: 5.5, cz: 32, rx: 2.0, rz: 2.0, orbitSpeed: 1.5,  orbitPhase: Math.PI * 1.33, radius: 1.00,  color: Color3.create(1.0, 0.5, 0.0), vis: 3.0, hid: 0.8 },
    { cx: 8, cy: 6.5, cz: 32, rx: 2.2, rz: 2.2, orbitSpeed: 1.9,  orbitPhase: Math.PI * 1.66, radius: 0.70,  color: Color3.create(1.0, 0.2, 0.0), vis: 3.5, hid: 1.1 },
    // 5 additional — interleaved heights, distinct phases and speeds
    { cx: 8, cy: 33, cz: 32, rx: 4.0, rz: 6.0, orbitSpeed: 0.70, orbitPhase: Math.PI * 0.25,  radius: 0.70,  color: Color3.create(1.0, 0.3, 0.1), vis: 3.8, hid: 2.0 },
    { cx: 8, cy: 24, cz: 32, rx: 5.0, rz: 3.5, orbitSpeed: 0.95, orbitPhase: Math.PI * 1.25,  radius: 1.10,  color: Color3.create(0.1, 0.9, 0.7), vis: 4.5, hid: 2.2 },
    { cx: 8, cy: 15, cz: 32, rx: 3.0, rz: 5.5, orbitSpeed: 1.20, orbitPhase: Math.PI * 0.60,  radius: 0.45,  color: Color3.create(0.8, 0.8, 0.1), vis: 2.8, hid: 1.6 },
    { cx: 8, cy:  8, cz: 32, rx: 5.5, rz: 3.0, orbitSpeed: 0.75, orbitPhase: Math.PI * 1.80,  radius: 0.90,  color: Color3.create(0.2, 0.4, 1.0), vis: 3.2, hid: 2.8 },
    { cx: 8, cy:  2, cz: 32, rx: 2.0, rz: 4.5, orbitSpeed: 1.60, orbitPhase: Math.PI * 1.10,  radius: 0.35,  color: Color3.create(1.0, 0.1, 0.6), vis: 2.2, hid: 1.2 },
  ]

  for (const d of orbitDefs) {
    const entity = engine.addEntity()
    Transform.create(entity, {
      position: Vector3.create(d.cx, d.cy, d.cz),
      scale: Vector3.create(d.radius, 0.08 * d.radius, d.radius),
    })
    showDisc(entity, d.radius, d.color)
    orbitStates.push({
      entity, cx: d.cx, cy: d.cy, cz: d.cz,
      rx: d.rx, rz: d.rz, orbitSpeed: d.orbitSpeed, orbitPhase: d.orbitPhase,
      radius: d.radius, color: d.color,
      visible: true,
      timer: Math.random() * d.vis,
      visibleDuration: d.vis, hiddenDuration: d.hid,
      t: 0,
    })
  }

  // ── Crossing discs — Option 4: speed randomizes on every respawn ─────────
  // minSpeed/maxSpeed define the range; a new random value is picked each time
  const crossDefs = [
    // North → South — x spread across full path (-17 → 20)
    { start: Vector3.create(-14, 35, BOX_Z_MAX), end: Vector3.create(-14, 35, BOX_Z_MIN), speed: 6, minSpeed: 3,  maxSpeed: 14, radius: 0.90,  color: Color3.create(1.0, 0.4, 0.0), respawn: 1.5 },
    { start: Vector3.create( -7, 22, BOX_Z_MAX), end: Vector3.create( -7, 22, BOX_Z_MIN), speed: 8, minSpeed: 4,  maxSpeed: 16, radius: 0.45,  color: Color3.create(0.8, 0.0, 0.8), respawn: 2.0 },
    { start: Vector3.create(  0, 10, BOX_Z_MAX), end: Vector3.create(  0, 10, BOX_Z_MIN), speed: 5, minSpeed: 3,  maxSpeed: 12, radius: 1.10,  color: Color3.create(0.2, 0.8, 1.0), respawn: 2.5 },
    { start: Vector3.create(  7, 28, BOX_Z_MAX), end: Vector3.create(  7, 28, BOX_Z_MIN), speed: 7, minSpeed: 4,  maxSpeed: 15, radius: 0.65,  color: Color3.create(0.9, 0.5, 0.1), respawn: 1.6 },
    { start: Vector3.create( 13, 16, BOX_Z_MAX), end: Vector3.create( 13, 16, BOX_Z_MIN), speed: 9, minSpeed: 5,  maxSpeed: 18, radius: 1.175, color: Color3.create(0.3, 0.9, 0.3), respawn: 2.2 },
    { start: Vector3.create( 18, 41, BOX_Z_MAX), end: Vector3.create( 18, 41, BOX_Z_MIN), speed: 6, minSpeed: 3,  maxSpeed: 14, radius: 0.35,  color: Color3.create(0.7, 0.1, 1.0), respawn: 1.3 },
    // South → North — x spread across full path
    { start: Vector3.create(-12, 30, BOX_Z_MIN), end: Vector3.create(-12, 30, BOX_Z_MAX), speed: 7, minSpeed: 4,  maxSpeed: 16, radius: 0.35,  color: Color3.create(1.0, 0.9, 0.1), respawn: 1.8 },
    { start: Vector3.create( -5, 18, BOX_Z_MIN), end: Vector3.create( -5, 18, BOX_Z_MAX), speed: 9, minSpeed: 5,  maxSpeed: 18, radius: 1.00,  color: Color3.create(0.0, 1.0, 0.5), respawn: 1.2 },
    { start: Vector3.create(  1,  6, BOX_Z_MIN), end: Vector3.create(  1,  6, BOX_Z_MAX), speed: 6, minSpeed: 3,  maxSpeed: 14, radius: 0.65,  color: Color3.create(1.0, 0.2, 0.5), respawn: 2.2 },
    { start: Vector3.create(  8, 25, BOX_Z_MIN), end: Vector3.create(  8, 25, BOX_Z_MAX), speed: 8, minSpeed: 4,  maxSpeed: 16, radius: 0.80,  color: Color3.create(0.1, 0.6, 0.9), respawn: 1.4 },
    { start: Vector3.create( 14, 13, BOX_Z_MIN), end: Vector3.create( 14, 13, BOX_Z_MAX), speed: 5, minSpeed: 3,  maxSpeed: 12, radius: 0.50,  color: Color3.create(1.0, 0.4, 0.8), respawn: 2.0 },
    { start: Vector3.create( 19, 38, BOX_Z_MIN), end: Vector3.create( 19, 38, BOX_Z_MAX), speed: 7, minSpeed: 4,  maxSpeed: 15, radius: 1.10,  color: Color3.create(0.4, 1.0, 0.2), respawn: 1.7 },
    // East → West
    { start: Vector3.create(BOX_X_MAX, 40, 30), end: Vector3.create(BOX_X_MIN, 40, 30), speed: 7, minSpeed: 4,  maxSpeed: 16, radius: 1.175, color: Color3.create(0.3, 0.6, 1.0), respawn: 2.0 },
    { start: Vector3.create(BOX_X_MAX, 15, 34), end: Vector3.create(BOX_X_MIN, 15, 34), speed: 8, minSpeed: 5,  maxSpeed: 18, radius: 0.50,  color: Color3.create(1.0, 0.5, 0.2), respawn: 1.5 },
    { start: Vector3.create(BOX_X_MAX, 26, 27), end: Vector3.create(BOX_X_MIN, 26, 27), speed: 6, minSpeed: 3,  maxSpeed: 14, radius: 0.75,  color: Color3.create(0.6, 0.0, 0.8), respawn: 1.9 },
    { start: Vector3.create(BOX_X_MAX,  5, 33), end: Vector3.create(BOX_X_MIN,  5, 33), speed: 9, minSpeed: 5,  maxSpeed: 20, radius: 0.35,  color: Color3.create(0.9, 0.8, 0.0), respawn: 1.1 },
    // West → East
    { start: Vector3.create(BOX_X_MIN, 25, 28), end: Vector3.create(BOX_X_MAX, 25, 28), speed: 6, minSpeed: 3,  maxSpeed: 14, radius: 0.80,  color: Color3.create(0.9, 0.1, 0.9), respawn: 1.8 },
    { start: Vector3.create(BOX_X_MIN,  8, 36), end: Vector3.create(BOX_X_MAX,  8, 36), speed: 9, minSpeed: 5,  maxSpeed: 18, radius: 0.40,  color: Color3.create(0.1, 1.0, 0.7), respawn: 1.0 },
    // West → East (2 additional)
    { start: Vector3.create(BOX_X_MIN, 33, 31), end: Vector3.create(BOX_X_MAX, 33, 31), speed: 7, minSpeed: 4, maxSpeed: 15, radius: 1.00,  color: Color3.create(1.0, 0.3, 0.3), respawn: 2.1 },
    { start: Vector3.create(BOX_X_MIN, 12, 26), end: Vector3.create(BOX_X_MAX, 12, 26), speed: 8, minSpeed: 4, maxSpeed: 16, radius: 0.55,  color: Color3.create(0.2, 0.9, 1.0), respawn: 1.3 },
  ]

  for (const d of crossDefs) {
    const entity = engine.addEntity()
    Transform.create(entity, {
      position: Vector3.clone(d.start),
      scale: Vector3.create(d.radius, 0.08 * d.radius, d.radius),
    })
    showDisc(entity, d.radius, d.color)
    crossStates.push({
      entity, start: d.start, end: d.end,
      speed: d.speed, minSpeed: d.minSpeed, maxSpeed: d.maxSpeed,
      radius: d.radius, color: d.color,
      visible: true, respawnDelay: d.respawn,
      timer: 0, progress: 0,
    })
  }

  // ── Systems ──────────────────────────────────────────────────────────────
  // Option 2: vertical sweeping walls
  createWalls()

  // Option 3: rising discs from below
  createRisingDiscs()

  engine.addSystem((dt: number) => {
    for (const s of orbitStates) {
      s.t += dt
      s.timer -= dt

      const angle = s.orbitSpeed * 0.75 * s.t + s.orbitPhase
      const tr = Transform.getMutable(s.entity)
      tr.position.x = s.cx + s.rx * Math.cos(angle)
      tr.position.y = s.cy
      tr.position.z = s.cz + s.rz * Math.sin(angle)

      if (s.timer <= 0) {
        if (s.visible) {
          hideDisc(s.entity)
          s.visible = false
          s.timer = s.hiddenDuration
        } else {
          showDisc(s.entity, s.radius, s.color)
          s.visible = true
          s.timer = s.visibleDuration
        }
      }
    }

    for (const s of crossStates) {
      if (!s.visible) {
        s.timer -= dt
        if (s.timer <= 0) {
          // Re-randomize speed on every respawn — breaks pattern memorization
          s.speed = s.minSpeed + Math.random() * (s.maxSpeed - s.minSpeed)
          const tr = Transform.getMutable(s.entity)
          tr.position.x = s.start.x
          tr.position.y = s.start.y
          tr.position.z = s.start.z
          showDisc(s.entity, s.radius, s.color)
          s.visible = true
          s.progress = 0
        }
        continue
      }

      const totalDist = Vector3.distance(s.start, s.end)
      s.progress += (s.speed * 0.75 * dt) / totalDist

      if (s.progress >= 1) {
        hideDisc(s.entity)
        s.visible = false
        s.timer = s.respawnDelay
      } else {
        const tr = Transform.getMutable(s.entity)
        tr.position.x = s.start.x + (s.end.x - s.start.x) * s.progress
        tr.position.y = s.start.y + (s.end.y - s.start.y) * s.progress
        tr.position.z = s.start.z + (s.end.z - s.start.z) * s.progress
      }
    }
  })
}

function showDisc(entity: Entity, radius: number, color: Color3) {
  MeshRenderer.setCylinder(entity, radius, radius)
  MeshCollider.setCylinder(entity, radius, radius, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.create(color.r, color.g, color.b, 0.5),
    emissiveColor: color,
    emissiveIntensity: 1.5,
    castShadows: false,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
  })
}

function hideDisc(entity: Entity) {
  MeshRenderer.deleteFrom(entity)
  MeshCollider.deleteFrom(entity)
  Material.deleteFrom(entity)
}

// ─── Option 2: Vertical sweeping walls ───────────────────────────────────────
// Tall thin box panels that sweep across the descent corridor edge-to-edge.
// Width: 0.3m  Height: 6m  Depth: 0.3m — forces the player to thread a gap.

type WallState = {
  entity: Entity
  start: Vector3; end: Vector3
  speed: number
  visible: boolean
  respawnDelay: number
  timer: number
  progress: number
  color: Color3
  rotSpeed: number   // Y-axis spin speed in radians/sec
  rotAngle: number   // accumulated rotation angle
}

const wallStates: WallState[] = []

const WALL_W = 3.0   // width as seen from above
const WALL_H = 6     // tall enough to block mid-jump
const WALL_D = 0.3   // thin edge

function createWalls() {
  const defs = [
    // N→S walls at varying heights (x centered on 8)
    { start: Vector3.create( 8, 20, BOX_Z_MAX), end: Vector3.create( 8, 20, BOX_Z_MIN), speed: 5, color: Color3.create(1.0, 0.2, 0.2), respawn: 2.0, rotSpeed:  1.2 },
    { start: Vector3.create(11, 32, BOX_Z_MAX), end: Vector3.create(11, 32, BOX_Z_MIN), speed: 7, color: Color3.create(1.0, 0.6, 0.1), respawn: 1.5, rotSpeed: -0.9 },
    // S→N walls
    { start: Vector3.create( 5, 12, BOX_Z_MIN), end: Vector3.create( 5, 12, BOX_Z_MAX), speed: 6, color: Color3.create(0.2, 0.8, 1.0), respawn: 1.8, rotSpeed:  1.5 },
    { start: Vector3.create( 9, 38, BOX_Z_MIN), end: Vector3.create( 9, 38, BOX_Z_MAX), speed: 8, color: Color3.create(0.8, 0.2, 1.0), respawn: 2.2, rotSpeed: -1.1 },
    // E→W walls
    { start: Vector3.create(BOX_X_MAX, 26, 32), end: Vector3.create(BOX_X_MIN, 26, 32), speed: 6, color: Color3.create(0.2, 1.0, 0.4), respawn: 1.6, rotSpeed:  0.8 },
    // W→E walls
    { start: Vector3.create(BOX_X_MIN, 16, 30), end: Vector3.create(BOX_X_MAX, 16, 30), speed: 7, color: Color3.create(1.0, 1.0, 0.2), respawn: 2.0, rotSpeed: -1.3 },
  ]

  for (const d of defs) {
    const entity = engine.addEntity()
    Transform.create(entity, {
      position: Vector3.clone(d.start),
      scale: Vector3.create(WALL_W, WALL_H, WALL_D),
    })
    showWall(entity, d.color)
    wallStates.push({
      entity, start: d.start, end: d.end,
      speed: d.speed, color: d.color,
      visible: true, respawnDelay: d.respawn,
      timer: 0, progress: 0,
      rotSpeed: d.rotSpeed, rotAngle: 0,
    })
  }

  engine.addSystem((dt: number) => {
    for (const s of wallStates) {
      if (!s.visible) {
        s.timer -= dt
        if (s.timer <= 0) {
          const tr = Transform.getMutable(s.entity)
          tr.position.x = s.start.x
          tr.position.y = s.start.y
          tr.position.z = s.start.z
          showWall(s.entity, s.color)
          s.visible = true
          s.progress = 0
        }
        continue
      }

      s.rotAngle += s.rotSpeed * 6 * dt

      const totalDist = Vector3.distance(s.start, s.end)
      s.progress += (s.speed * 0.75 * dt) / totalDist

      if (s.progress >= 1) {
        hideWall(s.entity)
        s.visible = false
        s.timer = s.respawnDelay
      } else {
        const tr = Transform.getMutable(s.entity)
        tr.position.x = s.start.x + (s.end.x - s.start.x) * s.progress
        tr.position.y = s.start.y
        tr.position.z = s.start.z + (s.end.z - s.start.z) * s.progress
        tr.rotation = Quaternion.fromEulerDegrees(0, s.rotAngle * (180 / Math.PI), 0)
      }
    }
  })
}

// ─── Option 3: Rising discs ───────────────────────────────────────────────────
// Discs spawn at ground level (y=0) and rise upward through the descent path.
// Visible from above so the player can see them coming — but must judge timing.

type RiseState = {
  entity: Entity
  x: number; z: number         // base horizontal position
  riseSpeed: number             // m/s upward
  maxY: number                  // altitude at which the disc despawns
  radius: number; color: Color3
  visible: boolean
  respawnDelay: number
  timer: number
  y: number                     // current altitude
  t: number                     // accumulated time for vibration
  vibAmp: number                // vibration amplitude in meters
  vibPhaseX: number             // x vibration phase offset
  vibPhaseZ: number             // z vibration phase offset
}

const riseStates: RiseState[] = []

function createRisingDiscs() {
  // Corkscrew: ~1 full orbit per 3 seconds → ω = 2π/3 rad/s
  // Each disc gets a unique phase so they spiral out of sync
  const VIB_OMEGA = (2 * Math.PI) / 3

  const defs = [
    // All centered on (0, 32) — Lissajous path guarantees 2 center crossings/revolution
    // vibAmp controls the figure-eight wingspan; phases staggered so no two are in sync
    { x: 8, z: 32, riseSpeed: 12, maxY: 45, radius: 0.80,  color: Color3.create(1.0, 0.2, 0.2), respawn: 2.5, vibAmp: 1.5 },
    { x: 8, z: 32, riseSpeed: 16, maxY: 40, radius: 0.50,  color: Color3.create(1.0, 0.6, 0.1), respawn: 1.8, vibAmp: 1.0 },
    { x: 8, z: 32, riseSpeed: 10, maxY: 50, radius: 1.175, color: Color3.create(0.2, 0.6, 1.0), respawn: 3.0, vibAmp: 2.0 },
    { x: 8, z: 32, riseSpeed: 18, maxY: 35, radius: 0.35,  color: Color3.create(0.8, 0.2, 1.0), respawn: 1.5, vibAmp: 0.8 },
    { x: 8, z: 32, riseSpeed: 14, maxY: 42, radius: 0.65,  color: Color3.create(0.2, 1.0, 0.5), respawn: 2.0, vibAmp: 1.2 },
    { x: 8, z: 32, riseSpeed: 12, maxY: 48, radius: 1.00,  color: Color3.create(1.0, 1.0, 0.2), respawn: 2.2, vibAmp: 1.8 },
    { x: 8, z: 32, riseSpeed: 20, maxY: 38, radius: 0.45,  color: Color3.create(1.0, 0.3, 0.7), respawn: 1.6, vibAmp: 1.0 },
    { x: 8, z: 32, riseSpeed: 14, maxY: 44, radius: 0.60,  color: Color3.create(0.3, 1.0, 1.0), respawn: 2.0, vibAmp: 1.3 },
    { x: 8, z: 32, riseSpeed: 18, maxY: 36, radius: 0.40,  color: Color3.create(0.9, 0.5, 0.1), respawn: 1.7, vibAmp: 0.9 },
    { x: 8, z: 32, riseSpeed: 10, maxY: 50, radius: 1.10,  color: Color3.create(0.5, 0.2, 1.0), respawn: 2.8, vibAmp: 2.0 },
    { x: 8, z: 32, riseSpeed: 16, maxY: 40, radius: 0.70,  color: Color3.create(0.1, 0.9, 0.3), respawn: 1.9, vibAmp: 1.4 },
    { x: 8, z: 32, riseSpeed: 22, maxY: 34, radius: 0.35,  color: Color3.create(1.0, 0.8, 0.2), respawn: 1.4, vibAmp: 0.8 },
    { x: 8, z: 32, riseSpeed: 12, maxY: 46, radius: 0.90,  color: Color3.create(0.2, 0.5, 1.0), respawn: 2.3, vibAmp: 1.6 },
    { x: 8, z: 32, riseSpeed: 20, maxY: 39, radius: 0.55,  color: Color3.create(1.0, 0.1, 0.5), respawn: 1.6, vibAmp: 1.1 },
  ]

  for (let i = 0; i < defs.length; i++) {
    const d = defs[i]
    const entity = engine.addEntity()
    const startY = (i / defs.length) * d.maxY  // stagger starting altitudes
    Transform.create(entity, {
      position: Vector3.create(d.x, startY, d.z),
      scale: Vector3.create(d.radius, 0.08 * d.radius, d.radius),
    })
    showDisc(entity, d.radius, d.color)
    riseStates.push({
      entity, x: d.x, z: d.z,
      riseSpeed: d.riseSpeed, maxY: d.maxY,
      radius: d.radius, color: d.color,
      visible: true,
      respawnDelay: d.respawn,
      timer: 0,
      y: startY,
      t: (i / defs.length) * (2 * Math.PI),  // stagger vibration phase
      vibAmp: d.vibAmp,
      vibPhaseX: (i * 1.3) % (2 * Math.PI),  // unique x phase per disc
      vibPhaseZ: (i * 2.1) % (2 * Math.PI),  // unique z phase per disc
    })
  }

  engine.addSystem((dt: number) => {
    for (const s of riseStates) {
      if (!s.visible) {
        s.timer -= dt
        if (s.timer <= 0) {
          s.y = 0
          s.t = 0
          const theta0 = s.vibPhaseX
          const tr = Transform.getMutable(s.entity)
          tr.position.x = 8 + s.vibAmp * Math.sin(2 * theta0)
          tr.position.y = 0
          tr.position.z = 32 + s.vibAmp * Math.sin(theta0)
          showDisc(s.entity, s.radius, s.color)
          s.visible = true
        }
        continue
      }

      s.t += dt
      s.y += s.riseSpeed * 0.5625 * dt

      if (s.y >= s.maxY) {
        hideDisc(s.entity)
        s.visible = false
        s.timer = s.respawnDelay * 2
      } else {
        const tr = Transform.getMutable(s.entity)
        // Lissajous 2:1 figure-eight centered on (0, 32):
        // passes through exact center twice per revolution
        const theta = VIB_OMEGA * s.t + s.vibPhaseX
        tr.position.x = 8 + s.vibAmp * Math.sin(2 * theta)
        tr.position.y = s.y
        tr.position.z = 32 + s.vibAmp * Math.sin(theta)
      }
    }
  })
}

function showWall(entity: Entity, color: Color3) {
  MeshRenderer.setBox(entity)
  MeshCollider.setBox(entity, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.create(color.r, color.g, color.b, 0.85),
    emissiveColor: color,
    emissiveIntensity: 1.5,
    castShadows: false,
  })
}

function hideWall(entity: Entity) {
  MeshRenderer.deleteFrom(entity)
  MeshCollider.deleteFrom(entity)
  Material.deleteFrom(entity)
}
