import { UiEntity, Label, ReactEcs } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { score } from './target'
import { TheForgeUI } from './TheForge-SDK-UI'

export const uiMenu = () => [
    TheForgeUI(),
    Leaderboard()
]

export function Leaderboard() {
    return (
        <UiEntity uiTransform={{
            width: '100%',
            height: 'auto',
            justifyContent: 'center',
            alignSelf: 'center',
            positionType: 'absolute',
            position: { bottom: "5%" },
        }}>
            <UiEntity
                uiTransform={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: { top: 10, bottom: 10, left: 20, right: 20 },
                    display: score ? 'flex' : 'none',
                }}
                uiBackground={{ color: Color4.White() }}
            >
                <UiEntity
                    uiTransform={{
                        width: 220,
                        height: 220,
                        margin: { bottom: 10 },
                    }}
                    uiBackground={{
                        textureMode: 'stretch',
                        texture: { src: 'assets/scene/JumpZone.png' }
                    }}
                />
                <Label
                    value="distance is"
                    color={Color4.Red()}
                    fontSize={80}
                    font="sans-serif"
                    textAlign="middle-center"
                />
                <Label
                    value={`${score} meters`}
                    color={Color4.Red()}
                    fontSize={80}
                    font="sans-serif"
                    textAlign="middle-center"
                />
            </UiEntity>
        </UiEntity>
    )
}