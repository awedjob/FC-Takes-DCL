import {
  engine,
  Entity,
  InputAction,
  Material,
  MaterialTransparencyMode,
  MeshCollider,
  MeshRenderer,
  pointerEventsSystem,
  TextAlignMode,
  TextShape,
  Transform,
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { openExternalUrl } from '~system/RestrictedActions'
import { LeaderBoard } from './leaderboard'
import { WinnersCircle } from './winnersCircle'

export type CombinedBoardResult = {
  leaderboard: LeaderBoard
  winnersCircle: WinnersCircle
  updateCurrentPrize: (prizeName: string, prizeImageUrl: string) => void
}

export function createCombinedBoard(): CombinedBoardResult {
  // Single parent — centered between former board positions (z=40 and z=24)
  const parent = engine.addEntity()
  Transform.create(parent, {
    position: { x: 31.75, y: 3.0, z: 29 },
    rotation: Quaternion.fromEulerDegrees(0, 90, 0),
  })

  // One combined background spanning both sections
  const bg = engine.addEntity()
  MeshRenderer.setBox(bg)
  Material.setPbrMaterial(bg, { albedoColor: Color4.Black() })
  Transform.create(bg, {
    position: { x: -3, y: 0, z: 0 },
    scale: { x: 25.5, y: 16, z: 0.1 },
    parent: parent,
  })

  // ── Leaderboard section ───────────────────────────────────────────────────
  // x=-9 keeps it centered over world z=40. y=+3 aligns the title near the top.
  const lbSection = engine.addEntity()
  Transform.create(lbSection, {
    position: { x: -10, y: 3, z: -0.05 },
    parent: parent,
  })
  const leaderboard = new LeaderBoard(lbSection, 12)

  // ── Centre column: THIS WEEK'S PRIZE ─────────────────────────────────────
  // Sits below the Jump Zone logo (combined y≈5.75) and above the TP ring
  // (section local y=-4.5 → combined y≈-1.5). All positions relative to parent.
  const prizeLabel = engine.addEntity()
  Transform.create(prizeLabel, {
    position: Vector3.create(-4.5, 3.1, -0.1),
    parent: parent,
  })
  TextShape.create(prizeLabel, {
    text: "THIS WEEK'S PRIZE",
    fontSize: 3.5,
    textColor: Color4.create(1.0, 1.0, 0.5, 1),
    width: 10,
    height: 2,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
  })

  // Dark gray background plane behind prize section
  const prizeBackground = engine.addEntity()
  Transform.create(prizeBackground, {
    position: Vector3.create(-4.5, 2.15, -0.09),
    scale: Vector3.create(5.76, 3.15, 1),
    parent: parent,
  })
  MeshRenderer.setPlane(prizeBackground)
  MeshCollider.setPlane(prizeBackground)

  // Initial pointer events registration (required before data loads)
  pointerEventsSystem.onPointerDown(
    {
      entity: prizeBackground,
      opts: {
        hoverText: 'Prize',
        button: InputAction.IA_PRIMARY,
      },
    },
    () => {
      openExternalUrl({
        url: 'https://decentraland.org/marketplace/collections/0xb0d0d31910da4a14d4e05a9d51b6e9a99a85d676',
      })
    }
  )

  Material.setPbrMaterial(prizeBackground, {
    albedoColor: Color4.create(0.3, 0.3, 0.3, 1),
    emissiveColor: Color4.create(0.3, 0.3, 0.3, 1),
    emissiveIntensity: 0.3,
  })

  // Two-column layout: image (left, right-justified) + text (right, left-justified) at center line x=-5
  const prizeThumbnail = engine.addEntity()
  Transform.create(prizeThumbnail, {
    position: Vector3.create(-6.15, 1.8, -0.1),
    scale: Vector3.create(1.75, 1.75, 1),
    parent: parent,
  })
  MeshRenderer.setPlane(prizeThumbnail)

  // Set default material (updateCurrentPrize will override with texture when image loads)
  Material.setPbrMaterial(prizeThumbnail, {
    albedoColor: Color4.create(0.3, 0.3, 0.3, 1),
  })

  const prizeNameText = engine.addEntity()
  Transform.create(prizeNameText, {
    position: Vector3.create(-4.9, 1.8, -0.1),
    parent: parent,
  })
  TextShape.create(prizeNameText, {
    text: '----',
    fontSize: 4,
    textColor: Color4.White(),
    width: 8,
    height: 3,
    textAlign: TextAlignMode.TAM_MIDDLE_LEFT,
  })

  // ── Winners Circle section ────────────────────────────────────────────────
  // x=+7 keeps it centered over world z=24.
  const wcSection = engine.addEntity()
  Transform.create(wcSection, {
    position: { x: 7, y: 0, z: -0.05 },
    parent: parent,
  })
  const winnersCircle = new WinnersCircle(wcSection, 12)

  // ── Prize update helper ───────────────────────────────────────────────────
  function updateCurrentPrize(name: string, imageUrl: string) {
    TextShape.getMutable(prizeNameText).text = name

    // Re-register pointer events to activate them (required like in Winners Circle)
    pointerEventsSystem.onPointerDown(
      {
        entity: prizeBackground,
        opts: {
          hoverText: name || 'Prize',
          button: InputAction.IA_PRIMARY,
        },
      },
      () => {
        openExternalUrl({
          url: 'https://decentraland.org/marketplace/collections/0xb0d0d31910da4a14d4e05a9d51b6e9a99a85d676',
        })
      }
    )

    if (imageUrl) {
      Material.setPbrMaterial(prizeThumbnail, {
        texture: Material.Texture.Common({ src: imageUrl }),
        emissiveTexture: Material.Texture.Common({ src: imageUrl }),
        emissiveIntensity: 0.8,
        transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
      })
    }
  }

  return { leaderboard, winnersCircle, updateCurrentPrize }
}
