import { authorize } from './middleware'

export interface Env {
  HEADY_JWT_SECRET: string
  RATE_LIMITER: any
}

export default {
  async fetch(request: Request, env: Env) {
    const auth = await authorize(request, env)
    
    if (!auth.valid) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    return fetch(request.url.replace('api.', 'api-origin.'), {
      ...request,
      headers: {
        ...request.headers,
        'x-heady-user-id': auth.userId,
        'x-heady-user-roles': auth.roles.join(',')
      }
    })
  }
}
