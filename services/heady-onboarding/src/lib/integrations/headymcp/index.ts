interface HeadyMCPConfig {
  userId: string
  apiKey: string
  tools: string[]
}

export async function registerWithHeadyMCP(config: HeadyMCPConfig): Promise<void> {
  const apiUrl = process.env.HEADYMCP_URL!
  const apiKey = process.env.HEADYMCP_API_KEY!

  try {
    const response = await fetch(`${apiUrl}/api/users/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        userId: config.userId,
        apiKey: config.apiKey,
        enabledTools: config.tools || ["chat", "code", "search", "embed", "deploy"],
        permissions: {
          filesystem: true,
          git: true,
          database: true,
          network: true
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HeadyMCP API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ Registered with HeadyMCP:`, data)

    return data
  } catch (error) {
    console.error("HeadyMCP registration error:", error)
    throw new Error("Failed to register with HeadyMCP")
  }
}

export async function getMCPServerConfig(userId: string): Promise<any> {
  const apiUrl = process.env.HEADYMCP_URL!
  const apiKey = process.env.HEADYMCP_API_KEY!

  try {
    const response = await fetch(`${apiUrl}/api/users/${userId}/config`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      throw new Error(`HeadyMCP API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("HeadyMCP config error:", error)
    return null
  }
}
