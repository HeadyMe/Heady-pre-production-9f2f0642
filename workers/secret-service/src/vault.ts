import { createCipheriv, randomBytes } from 'crypto'

export async function secureStore(kv: KVNamespace, userId: string, secret: string) {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', process.env.ENCRYPTION_KEY, iv)
  
  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  await kv.put(userId, `${iv.toString('hex')}:${encrypted}`)
}
