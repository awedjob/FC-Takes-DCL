import {
  Billboard,
  engine,
  Entity,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  Transform,
} from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'

// Fountain obstacle: glowing billboarded quads spray upward from the center of
// the target in ballistic arcs, forming a dome that obstructs the player's
// line of sight to the bullseye while they aim during the fall. No colliders —
// the challenge is vision, not dodging.
//
// The fountain runs intermittently: it sprays for a while, then cuts out and
// the airborne droplets fall and clear, opening a brief unobstructed window.
// Skilled players time their jump off the arch so they're aiming during a gap.

// Fountain base centered on the target
const CENTER_X = 8
const CENTER_Z = 32

// Particle sizes: 0.3m..0.7m in 0.05 steps
const SIZES = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]

// Radius of the emission area at the base — sized to the target's center red
// circle so the fountain rises as a column the full width of the bullseye
const EMIT_RADIUS = 1.0

// Each droplet's color is a random blend between deep purple and white.
// The blend is squared to bias hard toward the purple end — most droplets are
// deep purple, white is the occasional sparkle.
const PURPLE = Color3.create(0.28, 0.05, 0.65)

function randomPurpleWhite(): Color3 {
  const t = Math.random() * Math.random() // 0 = pure purple, 1 = pure white
  return Color3.create(
    PURPLE.r + (1 - PURPLE.r) * t,
    PURPLE.g + (1 - PURPLE.g) * t,
    PURPLE.b + (1 - PURPLE.b) * t
  )
}

const POOL_SIZE = 280
const EMIT_RATE = 100 // particles per second while the fountain is on

// Ballistics — slightly soft gravity for a floatier, fuller dome
const GRAVITY = 8
const LAUNCH_VY_MIN = 10 // peak ≈ vy²/(2g): 10 → ~6m
const LAUNCH_VY_MAX = 15 //                  15 → ~14m
const LAUNCH_VR_MIN = 0.5 // outward drift; keeps the dome footprint
const LAUNCH_VR_MAX = 2.5 // within the target's rings

// Intermittent spray. Airborne droplets need ~3s to rain out after cutoff, so
// the truly clear window is roughly (off duration − 3s).
// Durations are drawn from a MIXTURE so the rhythm can't be learned from a few
// observations: most gaps are short-but-real, but some are fake-outs too brief
// for the dome to ever clear — punishing anyone who jumps the moment the
// spray stops.
const ON_MIN = 3
const ON_MAX = 5
const OFF_MIN = 3.5 // normal gap: ~0.5-1.5s of genuinely clear view
const OFF_MAX = 4.5
const FAKEOUT_CHANCE = 0.3 // these gaps end before the dome clears
const FAKEOUT_MIN = 0.75
const FAKEOUT_MAX = 1.5

type ParticleState = {
  entity: Entity
  active: boolean
  size: number
  // position
  x: number
  y: number
  z: number
  // velocity
  vx: number
  vy: number
  vz: number
}

const particles: ParticleState[] = []
const inactivePool: ParticleState[] = []

let fountainOn = true
let phaseTimer = ON_MIN + Math.random() * (ON_MAX - ON_MIN)
let spawnAccum = 0

function launch(p: ParticleState) {
  p.size = SIZES[Math.floor(Math.random() * SIZES.length)]
  // Spawn uniformly across the emission disc (sqrt → even area coverage)
  const spawnDir = Math.random() * Math.PI * 2
  const spawnR = EMIT_RADIUS * Math.sqrt(Math.random())
  p.x = CENTER_X + spawnR * Math.cos(spawnDir)
  p.y = 0.2
  p.z = CENTER_Z + spawnR * Math.sin(spawnDir)

  const dir = Math.random() * Math.PI * 2
  const vr = LAUNCH_VR_MIN + Math.random() * (LAUNCH_VR_MAX - LAUNCH_VR_MIN)
  p.vx = vr * Math.cos(dir)
  p.vy = LAUNCH_VY_MIN + Math.random() * (LAUNCH_VY_MAX - LAUNCH_VY_MIN)
  p.vz = vr * Math.sin(dir)
  p.active = true
}

export function createParticleStream() {
  for (let i = 0; i < POOL_SIZE; i++) {
    const entity = engine.addEntity()
    MeshRenderer.setPlane(entity)
    Billboard.create(entity)
    Transform.create(entity, {
      position: Vector3.create(CENTER_X, 0, CENTER_Z),
      scale: Vector3.Zero(),
    })

    // Each pool slot keeps a fixed color for life — rewriting materials on
    // every relaunch (~100/s) caused renderer churn and GC micro-stutters
    const color = randomPurpleWhite()
    Material.setPbrMaterial(entity, {
      albedoColor: Color4.create(color.r, color.g, color.b, 0.9),
      emissiveColor: color,
      emissiveIntensity: 1.2,
      castShadows: false,
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    })

    const p: ParticleState = {
      entity,
      active: false,
      size: 0.1,
      x: CENTER_X, y: 0, z: CENTER_Z,
      vx: 0, vy: 0, vz: 0,
    }
    particles.push(p)
    inactivePool.push(p)
  }

  engine.addSystem((dt: number) => {
    // ── Fountain on/off cycle ──
    phaseTimer -= dt
    if (phaseTimer <= 0) {
      fountainOn = !fountainOn
      if (fountainOn) {
        phaseTimer = ON_MIN + Math.random() * (ON_MAX - ON_MIN)
      } else if (Math.random() < FAKEOUT_CHANCE) {
        // Fake-out: spray resumes before the airborne droplets finish falling
        phaseTimer = FAKEOUT_MIN + Math.random() * (FAKEOUT_MAX - FAKEOUT_MIN)
      } else {
        phaseTimer = OFF_MIN + Math.random() * (OFF_MAX - OFF_MIN)
      }
    }

    // ── Emit while on ──
    if (fountainOn) {
      spawnAccum += EMIT_RATE * dt
      while (spawnAccum >= 1 && inactivePool.length > 0) {
        spawnAccum -= 1
        const p = inactivePool.pop()!
        launch(p)
      }
      if (spawnAccum > 5) spawnAccum = 5 // don't bank a burst while pool is empty
    } else {
      spawnAccum = 0
    }

    // ── Ballistics ──
    for (const p of particles) {
      if (!p.active) continue

      p.vy -= GRAVITY * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt

      // Droplet hits the ground — back into the pool
      if (p.y <= 0) {
        p.active = false
        const hidden = Transform.getMutable(p.entity)
        hidden.scale.x = 0
        hidden.scale.y = 0
        hidden.scale.z = 0
        inactivePool.push(p)
        continue
      }

      const tr = Transform.getMutable(p.entity)
      tr.position.x = p.x
      tr.position.y = p.y
      tr.position.z = p.z
      tr.scale.x = p.size
      tr.scale.y = p.size
      tr.scale.z = p.size
    }
  })
}
