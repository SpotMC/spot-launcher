import { dbHelpers } from "../db"
import { getCloudCredentials } from "./cloud/credentials"

export async function getCloudApiUrl(): Promise<string> {
  const stored = await dbHelpers.getSetting("cloudApiUrl")
  if (stored) return stored
  return process.env.CLOUD_API_URL || "http://87.121.82.248:3001/api"
}

export async function getElyClientId(): Promise<string> {
  const stored = await dbHelpers.getSetting("elyClientId")
  if (stored) return stored
  return getCloudCredentials().elyby.clientId
}

export async function getElyClientSecret(): Promise<string> {
  const stored = await dbHelpers.getSetting("elyClientSecret")
  if (stored) return stored
  return getCloudCredentials().elyby.clientSecret
}

export async function getElyDeviceClientId(): Promise<string> {
  const stored = await dbHelpers.getSetting("elyDeviceClientId")
  if (stored) return stored
  return getCloudCredentials().elyby.deviceClientId || "spot-launcher"
}

const MC_MSA_CLIENT_ID = "00000000402b5328"

export async function getMicrosoftClientId(): Promise<string> {
  const stored = await dbHelpers.getSetting("microsoftClientId")
  if (stored) return stored
  return getCloudCredentials().microsoft.clientId || MC_MSA_CLIENT_ID
}

export async function getMicrosoftDeviceClientId(): Promise<string> {
  const stored = await dbHelpers.getSetting("microsoftDeviceClientId")
  if (stored) return stored
  return getCloudCredentials().microsoftDevice.clientId || MC_MSA_CLIENT_ID
}
