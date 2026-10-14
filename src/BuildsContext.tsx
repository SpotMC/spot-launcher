"use client"

import { createContext, useContext } from "react"
import { useBuilds as useBuildsHook } from "@/components/launcher/instance/use-builds"
import type { Build } from "@/components/launcher/instance/types"

export type BuildsContextValue = ReturnType<typeof useBuildsHook>

const BuildsContext = createContext<BuildsContextValue | undefined>(undefined)

export function BuildsProvider({ children }: { children: React.ReactNode }) {
  const value = useBuildsHook()
  return <BuildsContext.Provider value={value}>{children}</BuildsContext.Provider>
}

export function useBuildsContext() {
  const ctx = useContext(BuildsContext)
  if (!ctx) throw new Error("useBuildsContext must be used within BuildsProvider")
  return ctx
}
