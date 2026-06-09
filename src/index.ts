import { Color4, Vector3 } from '@dcl/sdk/math'
import { ColliderLayer, engine, GltfContainer, Material, MeshRenderer, Transform, VideoPlayer } from '@dcl/sdk/ecs'
import { target } from './target'
import { createTeleport } from './teleport'
import { createLogo } from './logo'
import * as utils from '@dcl-sdk/utils'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { uiMenu } from './ui'
import { userForgeUI } from './TheForge'
import { createArchTeleport } from './archTeleport'
import { artTimer, createArt, createArtTriggers } from './art'

export function main() {
  // Temporary position logger - remove after fixing
  let logTimer = 0
  engine.addSystem((dt: number) => {
    logTimer += dt
    if (logTimer > 2) {
      logTimer = 0
      const p = Transform.getOrNull(engine.PlayerEntity)
      if (p) console.log('Player pos: x=' + p.position.x.toFixed(2) + ' z=' + p.position.z.toFixed(2))
    }
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