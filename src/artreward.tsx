import ReactEcs, { Input, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { dimensions } from './TheForge-SDK-UI'
import { Color4 } from '@dcl/sdk/math'
import { openExternalUrl } from '~system/RestrictedActions'

let showArtReward: boolean = false

export function toggleArtReward() {
    showArtReward = !showArtReward
}

export function ArtReward() {
    return (
        <UiEntity
                uiTransform={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: dimensions.width * 1,
                    height: dimensions.height * 1,
                    margin: {bottom:'5%'},
                    positionType: 'absolute',
                    display: showArtReward ? 'flex' : 'none'
                }}
                >

                    <UiEntity
                uiTransform={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: dimensions.width * .5,
                    height: dimensions.height * .33,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Color4.create(19/255, 24/255, 38/255, 1),
                }}
                uiBackground={{color:Color4.create(19/255, 24/255, 38/255, 1)}}

                >
                    <UiEntity
                uiTransform={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '50%',
                    height: '100%',
                }}

                >
                    <UiEntity
                uiTransform={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '90%',
                    height: '10%',
                    margin: {bottom: '10%'}
                }}
                uiText={{value: "Thank you for visiting the Art Casters Show", fontSize: 25, color:Color4.create(1,1,1, 1)}}

                /><UiEntity
                uiTransform={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '60%',
                    height: '60%',
                }}
                uiBackground={{
                    texture: {src: 'assets/scene/JacqueReward.png'},
                    textureMode: 'stretch'
                }}

                />


                </UiEntity>

                <UiEntity
                uiTransform={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '50%',
                    height: '100%',
                }}

                >
                    <UiEntity
                uiTransform={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '90%',
                    height: '20%',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Color4.create(19/255, 24/255, 38/255, 1),
                }}
                uiBackground={{color:Color4.create(1, 0, 0, 1)}}
                uiText={{value: "Claim Reward", fontSize: 15, color:Color4.create(1,1,1, 1)}}
                onMouseDown={()=>{
                                openExternalUrl({url: "https://theforgecore.xyz/ws/irl-action?actionId=action_1755801830166_o78ai5xke&action=ACTION_EXECUTE"})
                }}
                />

                <UiEntity
                uiTransform={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    positionType: 'absolute',
                    position: {top: '5%', right: '5%'},
                    width: '5%',
                    height: '5%',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Color4.create(1, 1, 1, 1),
                }}
                uiText={{value: "X", fontSize: 15, color:Color4.create(1,1,1, 1)}}
                onMouseDown={()=>{
                                toggleArtReward()
                }}
                />
                </UiEntity>
                </UiEntity>
                </UiEntity>
    )
}