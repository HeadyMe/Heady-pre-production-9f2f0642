import { Router } from 'itty-router'
import { handleOAuth } from './auth'

export interface Env {
  HEADY_JWT_SECRET: string
  HEADY_OIDC_CLIENT_SECRET: string
  SESSIONS: KVNamespace
}

const router = Router()

router
  .get('/oauth/login', handleOAuth)
  .get('/oauth/callback', handleOAuth)
  .post('/oauth/token', handleOAuth)
  .post('/oauth/logout', handleOAuth)

export default {
  async fetch(request: Request, env: Env) {
    return router.handle(request)
  }
}
