"use client"

import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false

  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches
  const iOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return displayModeStandalone || iOSStandalone
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    setIsInstalled(isStandaloneMode())

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent
      installEvent.preventDefault()
      setDeferredPrompt(installEvent)
      setIsInstallable(true)
    }

    const onAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstallable(false)
      setIsInstalled(true)
    }

    const mediaQuery = window.matchMedia("(display-mode: standalone)")
    const onDisplayModeChange = () => {
      setIsInstalled(isStandaloneMode())
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onAppInstalled)
    mediaQuery.addEventListener("change", onDisplayModeChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onAppInstalled)
      mediaQuery.removeEventListener("change", onDisplayModeChange)
    }
  }, [])

  const shouldShow = useMemo(() => isInstallable && !isInstalled && Boolean(deferredPrompt), [deferredPrompt, isInstallable, isInstalled])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    try {
      await deferredPrompt.userChoice
    } finally {
      setDeferredPrompt(null)
      setIsInstallable(false)
      setIsInstalled(isStandaloneMode())
    }
  }

  if (!shouldShow) return null

  return (
    <div className="fixed right-4 bottom-20 z-50">
      <Button onClick={handleInstall} className="h-10 rounded-full bg-clinic-teal px-4 text-white shadow-lg hover:bg-clinic-teal/90">
        <Download className="size-4" />
        Install App
      </Button>
    </div>
  )
}
