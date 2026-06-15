import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ColliderLayer, engine, GltfContainer, InputModifier, Material, MaterialTransparencyMode, MeshRenderer, Transform, VideoPlayer } from '@dcl/sdk/ecs'
import { target } from './target'
import { createTeleport } from './teleport'
import { createLogo } from './logo'
import * as utils from '@dcl-sdk/utils'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { uiMenu } from './ui'
import { userForgeUI } from './TheForge'
import { createArchTeleport } from './archTeleport'
import { artTimer, createArt, createArtTriggers } from './art'
import { createObstacles } from './obstacles'
import { createParticleStream } from './particleStream'

export function main() {
  // Avatar position logger
  let logTimer = 0
  engine.addSystem((dt: number) => {
    logTimer += dt
    if (logTimer > 2) {
      logTimer = 0
      const p = Transform.getOrNull(engine.PlayerEntity)
      if (p) console.log('Avatar pos: x=' + p.position.x.toFixed(2) + ' y=' + p.position.y.toFixed(2) + ' z=' + p.position.z.toFixed(2))
    }
  })

  // Re-apply every 3 seconds so block-actions.ts can't override it
  let restrictionTimer = 0
  engine.addSystem((dt: number) => {
    if (!Transform.getOrNull(engine.PlayerEntity)) return
    restrictionTimer += dt
    if (restrictionTimer < 3) return
    restrictionTimer = 0
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: (InputModifier.Mode.Standard as any)({
        disableAll: false,
        disableJump: false,
        disableRun: false,
        disableDoubleJump: true,
        disableGliding: true,
      }),
    })
  })

  target()
  createArchTeleport()
  ReactEcsRenderer.setUiRenderer(uiMenu)
  //userForgeUI()
  createVideoScreen()
  

  createBuilding()


  // trigger art timer for the Art Week Event
  engine.addSystem(artTimer)
  createArtTriggers()
  createArt()
  // Replaced by the particle stream — restore if dodging obstacles return
  // createObstacles()

  // Sight-blocking particle geyser over the target
  createParticleStream()

  // Sky logo: 32m x 32m quad visible only from above 76.15m
  createSkyLogo()
}

function createBuilding() {
  const entity = engine.addEntity()
  GltfContainer.create(entity, {
    src: 'models/farcaster.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  Transform.create(entity, {
    position: { x: -26, y: 0, z: 48 },
    scale: { x: 1, y: 1, z: 1 }
  })
}

function createVideoScreen() {
const entity = engine.addEntity()
MeshRenderer.setPlane(entity)
Transform.create(entity, {
  position: { x: -25.5, y: 48, z: 62 },
  scale: { x: 16, y: 9, z: 1 }
})

// #2
VideoPlayer.create(entity, {
    src: 'videos/myVideo.mp4',
    playing: true,
})

// #3
const videoTexture = Material.Texture.Video({ videoPlayerEntity: entity })

Material.setPbrMaterial(entity, {
  texture: videoTexture, 
  emissiveTexture: videoTexture,
  emissiveIntensity: 1,
  emissiveColor: Color4.White()
})

}

function createSkyLogo() {
  // 32m x 32m flat horizontal quad at 76.15m height, centered above parcels
  // -131,90 -132,90 -131,91 -132,91 (the center 2x2 parcel block)
  // Lies flat in the X-Z plane, facing up (positive Y), visible from any distance above
  const entity = engine.addEntity()
  MeshRenderer.setPlane(entity)
  Transform.create(entity, {
    position: { x: 0, y: 76.1, z: 32 },
    scale: { x: 32, y: 32, z: 1 },
    rotation: Quaternion.fromEulerDegrees(90, 0, 0)
  })

  Material.setPbrMaterial(entity, {
    texture: Material.Texture.Common({
      src: 'assets/scene/JumpZone.png'
    }),
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
  })
}