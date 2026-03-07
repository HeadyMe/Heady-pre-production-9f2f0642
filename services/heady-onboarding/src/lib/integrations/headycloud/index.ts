interface HeadyCloudConfig {
  mode: "cloud" | "hybrid"
  filesystemAccess: boolean
  userId: string
}

export async function setupHeadyCloudWorkspace(config: HeadyCloudConfig): Promise<void> {
  const apiUrl = process.env.HEADYCLOUD_API_URL!
  const apiKey = process.env.HEADYCLOUD_API_KEY!

  try {
    const response = await fetch(`${apiUrl}/workspaces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        userId: config.userId,
        mode: config.mode,
        features: {
          filesystem: config.filesystemAccess,
          cloudStorage: true,
          vectorMemory: true,
          spatialCompute: true
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HeadyCloud API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ HeadyCloud workspace created:`, data)

    return data
  } catch (error) {
    console.error("HeadyCloud setup error:", error)
    throw new Error("Failed to setup HeadyCloud workspace")
  }
}

export async function getWorkspaceStatus(userId: string): Promise<any> {
  const apiUrl = process.env.HEADYCLOUD_API_URL!
  const apiKey = process.env.HEADYCLOUD_API_KEY!

  try {
    const response = await fetch(`${apiUrl}/workspaces/${userId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      throw new Error(`HeadyCloud API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("HeadyCloud status error:", error)
    return null
  }
}
