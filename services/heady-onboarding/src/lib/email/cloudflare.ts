import { Cloudflare } from "cloudflare"

const cf = new Cloudflare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
})

export async function setupCloudflareEmail(
  fromEmail: string,
  toEmail: string
): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID!

  try {
    // Create email routing rule
    await cf.emailRouting.rules.create(zoneId, {
      actions: [{
        type: "forward",
        value: [toEmail]
      }],
      matchers: [{
        type: "literal",
        field: "to",
        value: fromEmail
      }],
      enabled: true,
      name: `Forward ${fromEmail} to ${toEmail}`,
      priority: 0
    })

    console.log(`✅ Email forwarding configured: ${fromEmail} → ${toEmail}`)
  } catch (error) {
    console.error("Cloudflare email setup error:", error)
    throw new Error("Failed to configure email forwarding")
  }
}

export async function deleteEmailForwarding(fromEmail: string): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID!

  try {
    // Get all routing rules
    const rules = await cf.emailRouting.rules.list(zoneId)

    // Find and delete the rule for this email
    const rule = rules.result?.find((r: any) => 
      r.matchers?.[0]?.value === fromEmail
    )

    if (rule) {
      await cf.emailRouting.rules.delete(zoneId, rule.id)
      console.log(`✅ Email forwarding deleted for ${fromEmail}`)
    }
  } catch (error) {
    console.error("Delete email forwarding error:", error)
    throw new Error("Failed to delete email forwarding")
  }
}

export async function updateEmailForwarding(
  fromEmail: string,
  newToEmail: string
): Promise<void> {
  // Delete old rule and create new one
  await deleteEmailForwarding(fromEmail)
  await setupCloudflareEmail(fromEmail, newToEmail)
}
