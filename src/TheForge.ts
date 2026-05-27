import { engine, Transform, MeshRenderer, MeshCollider, Billboard, TextShape, TextAlignMode } from "@dcl/sdk/ecs"
import { openExternalUrl } from "~system/RestrictedActions"
import { getPlayer } from '@dcl/sdk/src/players'
import { conversationMessages, fetchUserConversations, loadedConversations, setForgeUI, addMessageToConversation } from './TheForge-SDK-UI';
import { Vector3, Quaternion, Color4 } from "@dcl/sdk/math";


/**
 * 
 * Forge SDK File v1.0.2
 * 
 */


//Obtain these values from The Forge website
export const QUEST_ID = "change-here-leave-quotes"
export const STEP_ID = "change-here-leave-quotes"
export const TASK_ID = "change-here-leave-quotes"
export const VERSE_ID = "38e50b40-a551-497a-8856-3d8a3bbd22fd"
export const ACTION_ID = "action_1755275911661_vmkr574tb"
export const forgeVariableKeys:Map<string, any> = new Map()


/////UI VARIABLES/////
export let showForgeUI = true //Set to true to show the forge UI
export let showChatIcon = false //Set to false to hide the chat icon//
export let showLoginSplashScreen = false //true to show the login splash screen on load, false to hide it
////////////////////////////////////////////////////////////


/////LEADERBOARD VARIABLES/////
export let showLeaderboard = false //Set to true to show the leaderboard UI
export let leaderboardID = "leaderboard_1755276207153_c62f43d7" //Set the leaderboard ID to show
export let leaderboardRefreshInterval = 3 //Refresh interval in seconds
export let leaderboardDisplayMode = "world" //Display mode: "screen" or "world"
export let leaderboardWidth = 0.2 //Width of leaderboard UI as percentage of screen width
export let leaderboardHeight = 0.5 //Height of leaderboard UI as percentage of screen height
export let showLeaderboardBackground = false //Show background panel
export let showLeaderboardRowBackground = true //Show row backgrounds
export let leaderboardWorldPosition = Vector3.create(25, 5, 5.8) //World position for billboard
export let leaderboardWorldRotation = Vector3.create(0, 137, 0) //World rotation for billboard
export let leaderboardWorldScale = Vector3.create(1, 1, 1) //World scale for billboard
// export let leaderboardXOffset = 0 //X offset (0-1) for screen mode
// export let leaderboardYOffset = 0 //Y offset (0-1) for screen mode
// export let leaderboardPosition = "Middle Right" //Position on screen (for screen mode)
////////////////////////////////////////////////////////////



////////////////////////////////////////////////////
//Event Functions
//These functions are called when the forge sends a message to the client
//You can tie your own functions to these events

//function onUserProfile(userProfile: any) {
//    yourFunction(userProfile)
//}

function onUserProfile(userProfile: any) {
    console.log("USER PROFILE", userProfile)
}

function onNewChatMessage(chatMessage: any) {
    console.log("NEW CHAT MESSAGE", chatMessage)
}

function onQuestComplete(questData:any) {
    console.log("QUEST COMPLETE", questData)
}

function onQuestStepComplete(questData:any) {
    console.log("QUEST STEP COMPLETE", questData)
}

function onQuestTaskComplete(questData:any) {
    console.log("QUEST TASK COMPLETE", questData)
}
////////////////////////////////////////////////////



////////////////////////////////////////////////////
//UI functions

/**
 * Call this function to use The Forge UI Rendering system
 * If implementing your own UI, add the `uiComponent` to your UI from the TheForgeUI.tsx file
 */
export function userForgeUI(){
    setForgeUI()
}

/**
 * Call this function to display the forge UI
 * @param value - true to display the forge UI, false to hide it
 */
export function displayForgeUI(value:boolean){
    showForgeUI = value
}

/**
 * Call this function to display the login splash screen
 * @param value - true to display the login splash screen, false to hide it
 */
export function setShowLoginSplashScreen(value:boolean){
    showLoginSplashScreen = value
}

/**
 * Call this function to display the chat icon
 * @param value - true to display the chat icon, false to hide it
 */
export function setShowChatIcon(value:boolean){
    showChatIcon = value
}
////////////////////////////////////////////////////





////////////////////////////////////////////////////
//Forge Functions

/**
 * Call this function to send a quest action to the forge
 * @param questId - The ID of the quest to send
 * @param stepId - The ID of the step to send
 * @param taskId - The ID of the task to send
 * @param variables - Array of variables - [{"variableId": "variableValue"}]
 */
export async function sendQuestAction(questId:string, stepId:string, taskId:string, variables:any = []) {
    internalSendAction("QUEST_ACTION", {
        questId: questId,
        stepId: stepId,
        taskId: taskId,
        variables: variables
    })
}

/**
 * Call this function to send a generic action to the forge
 * @param actionId - The ID of the action to send
 * @param variables - Array of variables - [{"variableId": "variableValue"}]
 */
export async function sendGenericAction(actionId:string, variables:any = []) {
    internalSendAction("GENERIC_ACTION", {
        actionId: actionId,
        variables: variables
    })
}

//get this variable to check if the player is connected to the forge
export let forgeConnected = false

//get this variable to check if the player is connecting to the forge
export let isConnecting = false

//Leaderboard state variables
export let leaderboardData: any = null
export let leaderboardError: string | null = null
export let isLoadingLeaderboard = false
export let lastLeaderboardUpdate = 0
export let leaderboard3DEntity: any = null
export let leaderboard3DTextEntities: any[] = []
export let leaderboard3DTitleEntity: any = null
export let leaderboard3DSubtitleEntity: any = null
export let leaderboard3DEntryEntities: any[] = [] // Fixed pool of 10 entry entities
export let leaderboard3DRankEntities: any[] = [] // Rank entities (left)
export let leaderboard3DNameEntities: any[] = [] // Name entities (center)
export let leaderboard3DScoreEntities: any[] = [] // Score entities (right)
export let leaderboard3DLoadingEntity: any = null
export let leaderboard3DErrorEntity: any = null
export let leaderboard3DNoDataEntity: any = null


/**
 * Call this function to connect to the forge
 * This will open the login page in a new tab
 * This will also start the heartbeat system
 */
export function ForgeConnect(){
    player = getPlayer()
    if(player){
        userId = player.userId
        openExternalUrl({url: `${clientUrl}/login?userId=${userId}`})

        if(!isHeartbeatRunning){
            engine.addSystem(ForgeHeartbeat)
            isHeartbeatRunning = true
        }
    }
}

/**
 * Call this function to set a variable for the forge
 * @param key - The key of the variable
 * @param value - The value of the variable
 */
export function setForgeVariableKey(key:string, value:any){
    forgeVariableKeys.set(key, value)
}

/**
 * Call this function to set multiple variables for the forge
 * @param keys - Array of keys
 * @param values - Array of values
 */
export function setForgeVariableKeys(keys:string[], values:any[]){
    if(keys.length !== values.length) return
    
    keys.forEach((key:string, index:number) => {
        setForgeVariableKey(key, values[index])
    })
}

/**
 * Call this function to get a variable for the forge
 * @param key - The key of the variable
 * @returns The value of the variable
 */
export function getForgeVariableKey(key:string){
    return forgeVariableKeys.get(key)
}

/**
 * Call this function to set the leaderboard ID
 * @param id - The leaderboard ID from The Forge system
 */
export function setForgeLeaderboardID(id: string) {
    leaderboardID = id
}

/**
 * Call this function to configure leaderboard display settings
 * @param options - Configuration options for the leaderboard
 */
export function configureForgeLeaderboard(options: {
    refreshInterval?: number,
    displayMode?: "screen" | "world",
    position?: string,
    width?: number,
    height?: number,
    showBackground?: boolean,
    showRowBackground?: boolean,
    xOffset?: number,
    yOffset?: number,
    worldPosition?: Vector3,
    worldRotation?: Vector3,
    worldScale?: Vector3
}) {
    if (options.refreshInterval !== undefined) leaderboardRefreshInterval = options.refreshInterval
    if (options.displayMode !== undefined) leaderboardDisplayMode = options.displayMode
    // if (options.position !== undefined) leaderboardPosition = options.position
    if (options.width !== undefined) leaderboardWidth = options.width
    if (options.height !== undefined) leaderboardHeight = options.height
    if (options.showBackground !== undefined) showLeaderboardBackground = options.showBackground
    if (options.showRowBackground !== undefined) showLeaderboardRowBackground = options.showRowBackground
    // if (options.xOffset !== undefined) leaderboardXOffset = options.xOffset
    // if (options.yOffset !== undefined) leaderboardYOffset = options.yOffset
    if (options.worldPosition !== undefined) leaderboardWorldPosition = options.worldPosition
    if (options.worldRotation !== undefined) leaderboardWorldRotation = options.worldRotation
    if (options.worldScale !== undefined) leaderboardWorldScale = options.worldScale
}

/**
 * Call this function to manually refresh leaderboard data
 */
export async function refreshForgeLeaderboard() {
    await fetchLeaderboardData()
}

/**
 * Call this function to show/hide the leaderboard
 * @param visible - true to show, false to hide
 */
export function setForgeLeaderboardVisible(visible: boolean) {
    showLeaderboard = visible
    
    // If showing leaderboard in world mode, create 3D entities
    if (visible && leaderboardDisplayMode === "world") {
        create3DLeaderboard()
    }
}

/**
 * Call this function to manually force create the 3D leaderboard (useful for debugging)
 */
export function force3DLeaderboard() {
    console.log("🔧 Force creating 3D leaderboard...")
    create3DLeaderboard()
}



































//////////////////////////////////```//////////////////
//Internal variables - do not need to be changed
let timer = 3
let errorPings = 0
export let token = ""
let userId = ""
let isHeartbeatRunning = false
export let player:any = undefined
let userProfiles:Map<string, any> = new Map()
let clientUrl = "https://theforgecore.xyz"
export let serverUrl = "https://theforgecore.xyz/ws"
let leaderboardApiUrl = "https://theforgecore.xyz/ws/api/leaderboard"
let leaderboardTimer = 0

function ForgeHeartbeat(dt:number) {
    if(timer > 0) {
        timer -= dt;
    } else {
        timer = 3;
        if(!token){
            sendTokenPing()
        }else{
            isConnecting = false
            sendHeartbeat();
        }
    }

    // Handle leaderboard refresh timer
    if(showLeaderboard && leaderboardID && leaderboardID !== "change-here-leave-quotes") {
        if(leaderboardTimer > 0) {
            leaderboardTimer -= dt;
        } else {
            leaderboardTimer = leaderboardRefreshInterval;
            fetchLeaderboardData();
        }
    }
}

async function sendTokenPing() {  
    if(errorPings > 9){
        engine.removeSystem(ForgeHeartbeat)
        isHeartbeatRunning = false
        return
    }
    isConnecting = true

    try{
        let response = await fetch(`${serverUrl}/rest-client/client-token/${userId}/${VERSE_ID}`)
        let data = await response.json()
        if(data.success){
            token = data.token
            errorPings = 0
        }else{
            errorPings++
        }
    }
    catch(e:any){
        console.error(e)
        errorPings++
    }
}

async function sendHeartbeat() {  
    console.log('sending heartbeat')
    let transform = Transform.get(engine.PlayerEntity).position
    try{
        let response = await fetch(`${serverUrl}/rest-client/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                position: transform
            })
        })
        let data = await response.json()
        if(data.success && data.messages && data.messages.length > 0){

             const connectedUser = data.messages.find((msg:any) => msg.type === "USER_PROFILE")
             if(connectedUser && !forgeConnected){
                 forgeConnected = true
                 let userProfile = {...connectedUser.message, artifacts:connectedUser.message.rewards || []}
                 delete userProfile.rewards
                 userProfiles.set(player.userId, userProfile)
                 onUserProfile(userProfile)
                 fetchUserConversations()
             }

             data.messages.forEach((msg:any) => {
                console.log("FORGE MESSAGE", JSON.stringify(msg, null, 2))
                checkForNewChatMessages(msg)
                checkForQuestComplete(msg)
                checkForQuestStepComplete(msg)
                checkForQuestTaskComplete(msg)
            })
        }
    }
    catch(e:any){
        console.error(e)
    }
}

function internalSendAction(type:string, body:any){
    switch(type){
        case "QUEST_ACTION":
            let questVariables: any = {};
            body.variables && body.variables.forEach((variable:any) => {
                questVariables[variable.id] = variable.value;
            });    
            
            let questBody:any ={
                action: "QUEST_ACTION",
                questId: body.questId,
                stepId: body.stepId,
                taskId: body.taskId,
                variables: questVariables
            }
            sendAction(questBody)
            break
        case "GENERIC_ACTION":
            let genericVariables: any = {};
            body.variables && body.variables.forEach((variable:any) => {
                genericVariables[variable.id] = variable.value;
            });    
            
            let actionBody:any = {
                action: "EXECUTE_ACTION",
                actionId: body.actionId,
                verseId: VERSE_ID,
                variables: genericVariables
            }
            sendAction(actionBody)
            break;
        default:
            console.error("Invalid action type")
            break;
    }
}

async function sendAction(body:any){
    if(!forgeConnected){
        console.log("NOT CONNECTED TO FORGE")
        return
    }

    try{
        let response = await fetch(`${serverUrl}/rest-client/action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        })
        let data = await response.json()
        if(data.success && data.messages && data.messages.length > 0){
            data.messages.forEach((msg:any) => {
                console.log("FORGE MESSAGE", msg)
            })
        }
    }
    catch(e:any){
        console.error(e)
    }
}

function checkForNewChatMessages(msg:any){
    if(msg.type === "NEW_MESSAGE") {
        const chatMessage = msg.message.message
        console.log("New chat message received:", chatMessage)
        
        const conversationId = chatMessage.conversationId
        if (!conversationId) {
            console.error("No conversationId in message:", chatMessage)
            return
        }
        
        // // Update local conversation using the reactive helper function
        // addMessageToConversation(conversationId, chatMessage)
        
        // // Mark conversation as loaded
        // loadedConversations.add(conversationId)

        onNewChatMessage(chatMessage)
    }
}

function checkForQuestComplete(msg:any){
    if(msg.type === "QUEST_COMPLETE") {
        const questData = msg.message
        onQuestComplete(questData)
    }
}

function checkForQuestStepComplete(msg:any){
    if(msg.type === "QUEST_STEP_COMPLETE") {
        const questData = msg.message
        onQuestStepComplete(questData)
    }
}

function checkForQuestTaskComplete(msg:any){
    if(msg.type === "QUEST_TASK_COMPLETE") {
        const questData = msg.message
        onQuestTaskComplete(questData)
    }
}

async function fetchLeaderboardData() {
    if (!leaderboardID || leaderboardID === "change-here-leave-quotes") {
        leaderboardError = 'No leaderboard ID configured'
        return
    }
    
    if (isLoadingLeaderboard) {
        return
    }
    
    try {
        console.log(`📊 Fetching leaderboard data for ID: ${leaderboardID}`)
        isLoadingLeaderboard = true
        leaderboardError = null
        
        const url = `${leaderboardApiUrl}/${leaderboardID}`
        console.log(`🌐 API URL: ${url}`)
        
        const response = await fetch(url)
        console.log(`📡 Response status: ${response.status} ${response.statusText}`)
        
        if (!response.ok) {
            const errorText = await response.text()
            console.log(`❌ Response error text: ${errorText}`)
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
        }
        
        const data = await response.json()
        console.log(`📋 API Response data:`, data)
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch leaderboard data')
        }
        
        // Extract leaderboard info and rankings from API response
        leaderboardData = {
            id: data.leaderboard.id,
            name: data.leaderboard.name,
            description: data.leaderboard.description,
            category: data.leaderboard.category,
            participants: data.leaderboard.participants || 0,
            entries: data.rankings || [] // Use rankings as entries
        }
        
        lastLeaderboardUpdate = Date.now()
        console.log(`✅ Leaderboard data updated: ${leaderboardData.entries.length} entries`)
        
        // Update 3D text if in world mode
        if (leaderboardDisplayMode === "world") {
            update3DLeaderboardDisplay()
            isLoadingLeaderboard = false
        }
        
    } catch (error: any) {
        console.error('❌ Error fetching leaderboard data:', error)
        leaderboardError = error.message
        leaderboardData = null
        isLoadingLeaderboard = false
    } finally {
        isLoadingLeaderboard = false
    }
}

// Create 3D leaderboard entity for world mode
function create3DLeaderboard() {
    console.log("🔧 Creating 3D leaderboard...")
    
    // Clean up existing entities first
    cleanup3DLeaderboard()
    
    // Always create the main leaderboard entity as parent for all text entities
    leaderboard3DEntity = engine.addEntity()
    Transform.create(leaderboard3DEntity, {
        position: leaderboardWorldPosition,
        rotation: Quaternion.fromEulerDegrees(leaderboardWorldRotation.x, leaderboardWorldRotation.y, leaderboardWorldRotation.z),
        scale: leaderboardWorldScale
    })
    
    // Add background plane if enabled
    if (showLeaderboardBackground) {
        MeshRenderer.setPlane(leaderboard3DEntity)
        console.log("🎨 Created background plane")
    }
    console.log("📦 Created main leaderboard entity as parent")
    
    // Create all text entities upfront
    create3DLeaderboardEntities()
    
    // Update with current data
    update3DLeaderboardDisplay()
    
    console.log("✅ 3D Leaderboard created with entity pool")
}

// Clean up all 3D entities
function cleanup3DLeaderboard() {
    console.log("🗑️ Cleaning up 3D leaderboard entities...")
    
    if (leaderboard3DEntity) {
        engine.removeEntity(leaderboard3DEntity)
        leaderboard3DEntity = null
    }
    
    if (leaderboard3DTitleEntity) {
        engine.removeEntity(leaderboard3DTitleEntity)
        leaderboard3DTitleEntity = null
    }
    
    if (leaderboard3DSubtitleEntity) {
        engine.removeEntity(leaderboard3DSubtitleEntity)
        leaderboard3DSubtitleEntity = null
    }
    
    leaderboard3DEntryEntities.forEach(entity => {
        engine.removeEntity(entity)
    })
    leaderboard3DEntryEntities = []
    
    leaderboard3DRankEntities.forEach(entity => {
        engine.removeEntity(entity)
    })
    leaderboard3DRankEntities = []
    
    leaderboard3DNameEntities.forEach(entity => {
        engine.removeEntity(entity)
    })
    leaderboard3DNameEntities = []
    
    leaderboard3DScoreEntities.forEach(entity => {
        engine.removeEntity(entity)
    })
    leaderboard3DScoreEntities = []
    
    if (leaderboard3DLoadingEntity) {
        engine.removeEntity(leaderboard3DLoadingEntity)
        leaderboard3DLoadingEntity = null
    }
    
    if (leaderboard3DErrorEntity) {
        engine.removeEntity(leaderboard3DErrorEntity)
        leaderboard3DErrorEntity = null
    }
    
    if (leaderboard3DNoDataEntity) {
        engine.removeEntity(leaderboard3DNoDataEntity)
        leaderboard3DNoDataEntity = null
    }
    
    // Legacy cleanup
    leaderboard3DTextEntities.forEach(entity => {
        engine.removeEntity(entity)
    })
    leaderboard3DTextEntities = []
}

// Create all 3D text entities once
function create3DLeaderboardEntities() {
    console.log("📝 Creating 3D text entity pool...")
    
    // Create title entity as child of main leaderboard
    leaderboard3DTitleEntity = engine.addEntity()
    Transform.create(leaderboard3DTitleEntity, {
        position: Vector3.create(0, 2.5, 0.1), // Local position relative to parent
        rotation: Quaternion.create(0, 0, 0, 1), // No rotation needed (parent handles it)
        scale: Vector3.create(1 / leaderboardWorldScale.x, 1 / leaderboardWorldScale.y, 1 / leaderboardWorldScale.z),
        parent: leaderboard3DEntity
    })
    TextShape.create(leaderboard3DTitleEntity, {
        text: "",
        fontSize: 6,
        textColor: Color4.create(0, 1, 0.84, 1),
        // outlineWidth: 0.2,
        // outlineColor: Color4.create(0, 0, 0, 1),
        textAlign: TextAlignMode.TAM_MIDDLE_CENTER
    })
    console.log("📦 Created title entity")
    
    // Create subtitle entity as child of main leaderboard
    leaderboard3DSubtitleEntity = engine.addEntity()
    Transform.create(leaderboard3DSubtitleEntity, {
        position: Vector3.create(0, 1.8, 0.1), // Local position relative to parent
        rotation: Quaternion.create(0, 0, 0, 1), // No rotation needed (parent handles it)
        scale: Vector3.create(1 / leaderboardWorldScale.x, 1 / leaderboardWorldScale.y, 1 / leaderboardWorldScale.z),
        parent: leaderboard3DEntity
    })
    TextShape.create(leaderboard3DSubtitleEntity, {
        text: "",
        fontSize: 2,
        textColor: Color4.create(0.8, 0.8, 0.8, 1),
        outlineWidth: 0.05,
        outlineColor: Color4.create(0, 0, 0, 1),
        textAlign: 2
    })
    console.log("📦 Created subtitle entity")
    
    // Create pool of entry entities (10 rows with 3 entities each: rank, name, score)
    leaderboard3DRankEntities = []
    leaderboard3DNameEntities = []
    leaderboard3DScoreEntities = []
    
    for (let i = 0; i < 10; i++) {
        const fontSize = i < 3 ? 3 : 2.5
        
        // Rank entity (left side) as child of main leaderboard
        const rankEntity = engine.addEntity()
        const localY = 1.2 - (i * 0.4) // Local Y position relative to parent
        Transform.create(rankEntity, {
            position: Vector3.create(-2.5, localY, 0.1), // Local position relative to parent
            rotation: Quaternion.create(0, 0, 0, 1), // No rotation needed (parent handles it)
            scale: Vector3.create(1 / leaderboardWorldScale.x, 1 / leaderboardWorldScale.y, 1 / leaderboardWorldScale.z),
            parent: leaderboard3DEntity
        })
        TextShape.create(rankEntity, {
            text: "",
            fontSize: fontSize,
            textColor: Color4.create(1, 1, 1, 1),
            outlineWidth: 0.1,
            outlineColor: Color4.create(0, 0, 0, 1),
            textAlign: 1 // Left align
        })
        leaderboard3DRankEntities.push(rankEntity)
        
        // Name entity (center) as child of main leaderboard
        const nameEntity = engine.addEntity()
        Transform.create(nameEntity, {
            position: Vector3.create(0, localY, 0.1), // Local position relative to parent
            rotation: Quaternion.create(0, 0, 0, 1), // No rotation needed (parent handles it)
            scale: Vector3.create(1 / leaderboardWorldScale.x, 1 / leaderboardWorldScale.y, 1 / leaderboardWorldScale.z),
            parent: leaderboard3DEntity
        })
        TextShape.create(nameEntity, {
            text: "",
            fontSize: fontSize,
            textColor: Color4.create(1, 1, 1, 1),
            outlineWidth: 0.1,
            outlineColor: Color4.create(0, 0, 0, 1),
            textAlign: 2 // Center align
        })
        leaderboard3DNameEntities.push(nameEntity)
        
        // Score entity (right side) as child of main leaderboard
        const scoreEntity = engine.addEntity()
        Transform.create(scoreEntity, {
            position: Vector3.create(2.5, localY, 0.1), // Local position relative to parent
            rotation: Quaternion.create(0, 0, 0, 1), // No rotation needed (parent handles it)
            scale: Vector3.create(1 / leaderboardWorldScale.x, 1 / leaderboardWorldScale.y, 1 / leaderboardWorldScale.z),
            parent: leaderboard3DEntity
        })
        TextShape.create(scoreEntity, {
            text: "",
            fontSize: fontSize,
            textColor: Color4.create(1, 1, 1, 1),
            outlineWidth: 0.1,
            outlineColor: Color4.create(0, 0, 0, 1),
            textAlign: 3 // Right align
        })
        leaderboard3DScoreEntities.push(scoreEntity)
    }
    console.log("📦 Created 30 entry entities (10 ranks, 10 names, 10 scores)")
    
    // Create status entities as children of main leaderboard
    leaderboard3DLoadingEntity = engine.addEntity()
    Transform.create(leaderboard3DLoadingEntity, {
        position: Vector3.create(0, 0.5, 0.1), // Local position relative to parent
        rotation: Quaternion.create(0, 0, 0, 1), // No rotation needed (parent handles it)
        scale: Vector3.create(1 / leaderboardWorldScale.x, 1 / leaderboardWorldScale.y, 1 / leaderboardWorldScale.z),
        parent: leaderboard3DEntity
    })
    TextShape.create(leaderboard3DLoadingEntity, {
        text: "",
        fontSize: 1.5,
        textColor: Color4.create(0.8, 0.8, 0.8, 1),
        outlineWidth: 0.05,
        outlineColor: Color4.create(0, 0, 0, 1),
        textAlign: 2
    })
    
    leaderboard3DErrorEntity = engine.addEntity()
    Transform.create(leaderboard3DErrorEntity, {
        position: Vector3.create(0, 0.5, 0.1), // Local position relative to parent
        rotation: Quaternion.create(0, 0, 0, 1), // No rotation needed (parent handles it)
        scale: Vector3.create(1 / leaderboardWorldScale.x, 1 / leaderboardWorldScale.y, 1 / leaderboardWorldScale.z),
        parent: leaderboard3DEntity
    })
    TextShape.create(leaderboard3DErrorEntity, {
        text: "",
        fontSize: 1.5,
        textColor: Color4.create(1, 0.2, 0.2, 1),
        outlineWidth: 0.05,
        outlineColor: Color4.create(0, 0, 0, 1),
        textAlign: 2
    })
    
    leaderboard3DNoDataEntity = engine.addEntity()
    Transform.create(leaderboard3DNoDataEntity, {
        position: Vector3.create(0, 0.5, 0.1), // Local position relative to parent
        rotation: Quaternion.create(0, 0, 0, 1), // No rotation needed (parent handles it)
        scale: Vector3.create(1 / leaderboardWorldScale.x, 1 / leaderboardWorldScale.y, 1 / leaderboardWorldScale.z),
        parent: leaderboard3DEntity
    })
    TextShape.create(leaderboard3DNoDataEntity, {
        text: "",
        fontSize: 1.5,
        textColor: Color4.create(0.6, 0.6, 0.6, 1),
        outlineWidth: 0.05,
        outlineColor: Color4.create(0, 0, 0, 1),
        textAlign: 2
    })
    
    console.log("✅ Created all 3D text entities")
}

// Update 3D leaderboard display with current data (only updates text, doesn't create/destroy entities)
function update3DLeaderboardDisplay() {
    console.log("🔄 Updating 3D leaderboard display...")
    
    // Clear loading state first if we have data
    if (leaderboardData && !leaderboardError) {
        isLoadingLeaderboard = false
        console.log("✅ Cleared loading state - data available")
    }
    
    // Update title
    if (leaderboard3DTitleEntity) {
        const titleTextShape = TextShape.getMutable(leaderboard3DTitleEntity)
        titleTextShape.text = `${leaderboardData?.name || "LEADERBOARD"}`
        console.log("📝 Updated title text")
    }
    
    // Update subtitle
    // if (leaderboard3DSubtitleEntity) {
    //     const subtitleTextShape = TextShape.getMutable(leaderboard3DSubtitleEntity)
    //     subtitleTextShape.text = leaderboardData?.name || ""
    //     console.log("📝 Updated subtitle text:", leaderboardData?.name || "(empty)")
    // }
    
    // Hide all status entities first
    if (leaderboard3DLoadingEntity) {
        const loadingTextShape = TextShape.getMutable(leaderboard3DLoadingEntity)
        loadingTextShape.text = ""
    }
    
    if (leaderboard3DErrorEntity) {
        const errorTextShape = TextShape.getMutable(leaderboard3DErrorEntity)
        errorTextShape.text = ""
    }
    
    if (leaderboard3DNoDataEntity) {
        const noDataTextShape = TextShape.getMutable(leaderboard3DNoDataEntity)
        noDataTextShape.text = ""
    }
    
    // Clear all entry texts first
    leaderboard3DRankEntities.forEach(entity => {
        const textShape = TextShape.getMutable(entity)
        textShape.text = ""
    })
    
    leaderboard3DNameEntities.forEach(entity => {
        const textShape = TextShape.getMutable(entity)
        textShape.text = ""
    })
    
    leaderboard3DScoreEntities.forEach(entity => {
        const textShape = TextShape.getMutable(entity)
        textShape.text = ""
    })
    
    // Show appropriate state
    console.log("🔍 Current state check - Error:", leaderboardError, "Loading:", isLoadingLeaderboard, "Data:", !!leaderboardData)
    
    if (leaderboardError && !isLoadingLeaderboard) {
        console.log("❌ Showing error state")
        const errorTextShape = TextShape.getMutable(leaderboard3DErrorEntity)
        errorTextShape.text = `❌ ${leaderboardError}`
        return
    }
    
    if (isLoadingLeaderboard) {
        console.log("⏳ Showing loading state")
        const loadingTextShape = TextShape.getMutable(leaderboard3DLoadingEntity)
        loadingTextShape.text = "⏳ Loading..."
        return
    }
    
    if (!leaderboardData?.entries || leaderboardData.entries.length === 0) {
        console.log("📝 Showing no data state")
        const noDataTextShape = TextShape.getMutable(leaderboard3DNoDataEntity)
        noDataTextShape.text = "📝 No entries available"
        return
    }
    
    // Update entry texts using separate entities for rank, name, and score
    console.log(`📊 Updating ${leaderboardData.entries.length} leaderboard entries`)
    leaderboardData.entries.slice(0, 10).forEach((entry: any, index: number) => {
        if (index < leaderboard3DRankEntities.length) {
            // Get rank emoji and color
            let rankEmoji = `#${index + 1}`
            // if (index === 0) rankEmoji = "🥇"
            // else if (index === 1) rankEmoji = "🥈"
            // else if (index === 2) rankEmoji = "🥉"
            // else rankEmoji = `#${index + 1}`
            
            const playerName = entry.displayName || entry.username || 'Unknown Player'
            const score = formatScoreForDisplay(entry.balance || entry.score || entry.value || 0)
            const rankColor = getRankColor3D(index)
            
            // Update rank entity
            const rankTextShape = TextShape.getMutable(leaderboard3DRankEntities[index])
            rankTextShape.text = rankEmoji
            rankTextShape.textColor = rankColor
            
            // Update name entity
            const nameTextShape = TextShape.getMutable(leaderboard3DNameEntities[index])
            nameTextShape.text = playerName
            nameTextShape.textColor = Color4.create(1, 1, 1, 1) // White
            
            // Update score entity
            const scoreTextShape = TextShape.getMutable(leaderboard3DScoreEntities[index])
            scoreTextShape.text = score
            scoreTextShape.textColor = rankColor
            
            console.log(`📝 Updated entry ${index}: "${rankEmoji}" | "${playerName}" | "${score}"`)
        }
    })
    
    console.log("✅ 3D leaderboard display updated")
}

// Get rank color for 3D text
function getRankColor3D(rank: number): any {
    if (rank === 0) return Color4.create(1, 0.84, 0, 1) // Gold
    if (rank === 1) return Color4.create(0.75, 0.75, 0.75, 1) // Silver
    if (rank === 2) return Color4.create(0.8, 0.5, 0.2, 1) // Bronze
    return Color4.create(0.7, 0.9, 1, 1) // Light blue
}

// Format score for display
function formatScoreForDisplay(value: any): string {
    if (typeof value !== 'number') return value.toString()
    
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M'
    } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K'
    } else {
        return value.toLocaleString()
    }
}





// Initialize leaderboard on first load
function initializeLeaderboard(){
    if(showLeaderboard && leaderboardID && leaderboardID !== "change-here-leave-quotes") {
        console.log("✅ Leaderboard conditions met, fetching data...")
        // Fetch initial leaderboard data
        fetchLeaderboardData()
        
        // Create 3D entity if in world mode
        if (leaderboardDisplayMode === "world") {
            console.log("🌍 Creating 3D leaderboard...")
            create3DLeaderboard()
        }
    } else {
        console.log("❌ Leaderboard conditions not met")
    }
}

// Update display mode
export function setLeaderboardDisplayMode(mode: "screen" | "world") {
    console.log(`🔄 Switching display mode from ${leaderboardDisplayMode} to ${mode}`)
    leaderboardDisplayMode = mode
    
    if (mode === "world" && showLeaderboard) {
        console.log(`🌍 Creating 3D leaderboard. Data exists: ${!!leaderboardData}`)
        if (leaderboardData) {
            console.log(`📊 Leaderboard data available - ${leaderboardData.entries?.length || 0} entries`)
        }
        create3DLeaderboard()
    } else {
        console.log(`🖥️ Switching to screen mode, cleaning up 3D entities`)
        // Clean up 3D entities when switching to screen mode
        if (leaderboard3DEntity) {
            engine.removeEntityWithChildren(leaderboard3DEntity)
            leaderboard3DEntity = null
        }
        cleanup3DLeaderboard()
    }
}

// Call initialization
initializeLeaderboard()