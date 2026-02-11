import { Router } from 'itty-router'
import { secureStore } from './vault'

export interface Env {
  SECRET_VAULT: KVNamespace
}

const router = Router()

router
  .post('/associate', async (request, env) => {
    const { userId, secret } = await request.json()
    
    // Store with encryption and access controls
    await secureStore(env.SECRET_VAULT, userId, secret)
    
    return new Response('Association created', { status: 201 })
  })
  .get('/retrieve/:userId', async (request, env) => {
    const userId = request.params.userId
    const secret = await env.SECRET_VAULT.get(userId)
    
    if (!secret) return new Response('Not found', { status: 404 })
    
    return new Response(secret, { status: 200 })
  })

export default {
  fetch: router.handle
}
