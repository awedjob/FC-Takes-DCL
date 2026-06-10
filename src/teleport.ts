import { engine, executeTask, Material, MeshRenderer, pointerEventsSystem, Transform, MaterialTransparencyMode, EasingFunction, Tween, TweenLoop, TweenSequence, Entity } from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'

// Portal trigger zone center and half-extents
const PORTAL_X = 31.72
const PORTAL_Z = 33.56
const PORTAL_RADIUS = 2.5

let teleportCooldown = 0

export function createTeleport(parent: Entity) {
  const myEntity = engine.addEntity()
  MeshRenderer.setPlane(myEntity)

  Transform.create(myEntity, {
    position: { x: 5.5, y: -4.25, z: -0.1 },
    scale: { x: 3.75, y: 3.75, z: 1 },
    parent: parent
  })

  Tween.create(myEntity, {
    mode: Tween.Mode.Rotate({
      start: Quaternion.fromEulerDegrees(0, 0, 0),
      end: Quaternion.fromEulerDegrees(0, 0, 180),
    }),
    duration: 2000,
    easingFunction: EasingFunction.EF_LINEAR,
  })
  TweenSequence.create(myEntity, {
    loop: TweenLoop.TL_RESTART,
    sequence: [
      {
        mode: Tween.Mode.Rotate({
          start: Quaternion.fromEulerDegrees(0, 0, 180),
          end: Quaternion.fromEulerDegrees(0, 0, 360),
        }),
        duration: 2000,
        easingFunction: EasingFunction.EF_LINEAR,
      },
    ],
  })

  Material.setPbrMaterial(myEntity, {
    texture: Material.Texture.Common({
      src: 'assets/scene/PlasmaCircle.png',
    }),
    emissiveTexture: Material.Texture.Common({
      src: 'assets/scene/PlasmaCircle.png',
    }),
    emissiveColor: Color3.Purple(),
    emissiveIntensity: 1.0,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
  })

  engine.addSystem((dt: number) => {
    if (teleportCooldown > 0) {
      teleportCooldown -= dt
      return
    }
    const t = Transform.getOrNull(engine.PlayerEntity)
    if (!t) return
    const dx = t.position.x - PORTAL_X
    const dz = t.position.z - PORTAL_Z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < PORTAL_RADIUS) {
      teleportCooldown = 3
      executeTask(async () => {
        await movePlayerTo({
          newRelativePosition: Vector3.create(-27, 46, 34),
          cameraTarget: Vector3.create(8.25, 30.0, 36.0),
          avatarTarget: Vector3.create(-19.0, 46.0, 34),
        })
      })
    }
  })
}