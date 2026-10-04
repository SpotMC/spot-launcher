import { cn } from "@/lib/utils"
import type { LauncherSource } from "./translations"

const LAUNCHER_SOURCE_ICON_SRC: Record<LauncherSource, string> = {
  prism: "./launcher-icons/prism.png",
  gdlauncher: "./launcher-icons/gdlauncher.png",
  multimc: "./launcher-icons/multimc.png",
  polymc: "./launcher-icons/polymc.png",
  xlauncher: "./launcher-icons/xlauncher.svg",
  astralrinth: "./launcher-icons/astralrinth.webp",
  modrinthapp: "./launcher-icons/modrinthapp.png",
}

export function LauncherSourceIcon({ source, className }: { source: LauncherSource; className?: string }) {
  return (
    <img
      src={LAUNCHER_SOURCE_ICON_SRC[source]}
      alt=""
      className={cn("object-contain", className)}
      loading="lazy"
      decoding="async"
      aria-hidden="true"
    />
  )
}

export function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <path fill="currentColor" d="M67.328 67.331h60.669V128H67.328zm-67.325 0h60.669V128H.003zM67.328 0h60.669v60.669H67.328zM.003 0h60.669v60.669H.003z"/>
    </svg>
  )
}

export function ElyByIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
      <path fill="currentColor" d="M262 207.5V351h-37V64h37zM193.5 98v14.5H86V197h93v30H86v94l54.3.2 54.2.3v29l-72.7.3-72.8.2V83l72.3.2 72.2.3zm135.9 55.7c.3 1 7.3 31.7 15.6 68.3 8.4 36.6 15.5 67.3 15.8 68.3.4 1 7.8-26.8 18.2-68.3l17.5-70h20.2c12.5 0 20.3.4 20.3 1 0 .5-6.3 22.9-14 49.7-7.8 26.9-22.4 77.8-32.6 113.3s-19.5 67.2-20.6 70.5c-4.4 12.9-13.6 28.5-20.1 34.2-8.6 7.6-23 11.4-35.5 9.4-8.9-1.5-13.3-2.5-13.4-3.1-.1-.3.7-6.7 1.7-14.3l1.9-13.7 6.2.6c16.6 1.7 21-3.3 30.9-35.2l4.7-15.2-5.1-16.8c-2.7-9.3-10.4-35.6-17.1-58.4-19.1-65.1-35-119.4-35.5-120.8-.3-.9 4.1-1.2 20-1.2 18.5 0 20.4.2 20.9 1.7"/>
    </svg>
  )
}

