"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface VoiceWaveformProps {
  isActive?: boolean
  className?: string
}

export function VoiceWaveform({ isActive = false, className }: VoiceWaveformProps) {
  const [bars, setBars] = useState<number[]>(Array(20).fill(0))

  useEffect(() => {
    if (!isActive) {
      setBars(Array(20).fill(0))
      return
    }

    const interval = setInterval(() => {
      setBars(prev =>
        prev.map(() => Math.random() * 100)
      )
    }, 150)

    return () => clearInterval(interval)
  }, [isActive])

  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      {bars.map((height, index) => (
        <div
          key={index}
          className={cn(
            "bg-primary transition-all duration-150 ease-out rounded-full",
            "w-1 min-h-[4px]"
          )}
          style={{
            height: isActive ? `${Math.max(4, height * 0.4)}px` : '4px',
            opacity: isActive ? 0.7 + (height / 100) * 0.3 : 0.3
          }}
        />
      ))}
    </div>
  )
}
