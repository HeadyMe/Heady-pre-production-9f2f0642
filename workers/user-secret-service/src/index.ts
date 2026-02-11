import { Router } from 'itty-router'
import { loadUserSecrets } from './user-manager'

export interface Env {
  USER_SECRETS: KVNamespace
}

const router = Router()

router
  .get('/user/:userId/secret', async (request, env) => {
    const userId = request.params.userId
    const secret = await env.USER_SECRETS.get(userId)
    
    if (!secret) {
      return new Response('User not found', { status: 404 })
    }
    
    return new Response(secret, { status: 200 })
  })
  .post('/user/:userId/secret', async (request, env) => {
    const userId = request.params.userId
    const { secret } = await request.json()
    
    await env.USER_SECRETS.put(userId, JSON.stringify({
      secret,
      updated: new Date().toISOString()
    }))
    
    return new Response('Secret updated', { status: 200 })
  })
  .get('/gift/packages', async (request, env) => {
    const packages = await env.USER_SECRETS.get('gift_packages')
    return new Response(packages || '[]', { status: 200 })
  })

export default {
  fetch: router.handle
}
