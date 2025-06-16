"use client"

import dynamic from 'next/dynamic'
import { Skeleton } from "@/components/ui/skeleton"

const VoiceContainer = dynamic(() => import('@/components/voice-container').then(mod => ({ default: mod.VoiceContainer })), {
  loading: () => (
    <div className="w-full max-w-2xl space-y-8">
      <div className="flex flex-col items-center space-y-6">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="w-24 h-24 rounded-full" />
      </div>
      <div className="text-center">
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    </div>
  ),
  ssr: false
})

export default function VoicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      <VoiceContainer />
    </div>
  )
}
