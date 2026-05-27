import { LeaderBoard } from './leaderboard'
import { executeTask } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'
import { signedFetch } from '~system/SignedFetch'

const serverBaseUrl = 'https://fartarget-production.up.railway.app/'

// Get top scores from server and update the leaderboard display
export function fetchScores(leaderboard: LeaderBoard) {
  executeTask(async () => {
    try {
      const response = await signedFetch({
        url: serverBaseUrl + 'get-scores',
        init: {
          headers: { 'Content-Type': 'application/json' },
          method: 'GET'
        }
      })

      if (!response.body) {
        throw new Error('Invalid response')
      }

      const json = JSON.parse(response.body)
      console.log('Scores fetched: ', json)

      if (!json.valid) {
        throw new Error('Does not pass validation check')
      }

      leaderboard.updateBoard(json.topTen)
    } catch (e) {
      console.log('error fetching scores from server: ' + e)
    }
  })
}

// Submit a score to the server
export function publishScore(score: number, leaderboard: LeaderBoard) {
  executeTask(async () => {
    // Get player data fresh inside the async task — calling getPlayer() at module
    // init time returns null because the player entity isn't loaded yet.
    const userData = getPlayer()

    if (!userData) {
      console.log('Could not get player data — score not submitted')
      return
    }

    // Fall back to userId if the player has no display name set
    const playerName =
      userData.name && userData.name.trim() !== '' ? userData.name : userData.userId

    try {
      const response = await signedFetch({
        url: serverBaseUrl + 'publish-score',
        init: {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          body: JSON.stringify({
            id: userData.userId,
            name: playerName,
            score: score,
            wallet: userData.userId
          })
        }
      })

      if (!response.body) {
        throw new Error('Invalid response')
      }

      const json = JSON.parse(response.body)
      console.log('Publish score response: ', json)

      if (!json.valid) {
        throw new Error('Does not pass validation check')
      }

      console.log('Score published successfully')
      fetchScores(leaderboard)
    } catch (e) {
      console.log('error posting to server: ' + e)
    }
  })
}

// Get a specific user's best score
export function getUserScore(leaderboard: LeaderBoard) {
  executeTask(async () => {
    const userData = getPlayer()

    if (!userData) {
      console.log('Could not get player data')
      return 0
    }

    try {
      const response = await signedFetch({
        url: serverBaseUrl + 'user-score/' + userData.userId,
        init: {
          headers: { 'Content-Type': 'application/json' },
          method: 'GET'
        }
      })

      if (!response.body) {
        throw new Error('Invalid response')
      }

      const json = JSON.parse(response.body)
      console.log('User score response: ', json)

      if (!json.valid) {
        throw new Error('Does not pass validation check')
      }

      if (json.score) {
        console.log('User best score: ', json.score.score)
        return json.score.score
      } else {
        console.log('No score found for user')
        return 0
      }
    } catch (e) {
      console.log('error fetching user score: ' + e)
      return 0
    }
  })
}