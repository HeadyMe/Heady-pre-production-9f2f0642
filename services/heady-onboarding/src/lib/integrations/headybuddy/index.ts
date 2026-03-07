interface BuddyConfig {
  userId: string
  customUIs: Array<{
    id: string
    name: string
    config: Record<string, any>
  }>
  contexts: Array<{
    id: string
    name: string
    active: boolean
  }>
  preferences: Record<string, any>
}

export async function syncBuddyConfig(config: BuddyConfig): Promise<void> {
  const apiUrl = process.env.HEADYBUDDY_API_URL!
  const apiKey = process.env.HEADYBUDDY_API_KEY!

  try {
    const response = await fetch(`${apiUrl}/api/buddy/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(config)
    })

    if (!response.ok) {
      throw new Error(`HeadyBuddy API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ HeadyBuddy config synced:`, data)

    return data
  } catch (error) {
    console.error("HeadyBuddy sync error:", error)
    throw new Error("Failed to sync HeadyBuddy configuration")
  }
}

export async function getBuddyStatus(userId: string): Promise<any> {
  const apiUrl = process.env.HEADYBUDDY_API_URL!
  const apiKey = process.env.HEADYBUDDY_API_KEY!

  try {
    const response = await fetch(`${apiUrl}/api/buddy/${userId}/status`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      throw new Error(`HeadyBuddy API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("HeadyBuddy status error:", error)
    return null
  }
}

export async function updateBuddyContext(userId: string, contextId: string, active: boolean): Promise<void> {
  const apiUrl = process.env.HEADYBUDDY_API_URL!
  const apiKey = process.env.HEADYBUDDY_API_KEY!

  try {
    await fetch(`${apiUrl}/api/buddy/${userId}/context/${contextId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ active })
    })

    console.log(`✅ HeadyBuddy context ${contextId} updated: ${active}`)
  } catch (error) {
    console.error("HeadyBuddy context update error:", error)
    throw new Error("Failed to update HeadyBuddy context")
  }
}
