"use client"

import { useSTT } from "@/hooks/use-stt"
import { useTTS } from "@/hooks/use-tts"
import { useWebhook } from "@/hooks/use-webhook"
import { Button } from "@/components/ui/button"
import { VoiceWaveform } from "@/components/ui/voice-waveform"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mic, Square, AlertCircle, Volume2, VolumeX } from "lucide-react"
import { useState, useMemo } from "react"
import { toast } from "sonner"

interface Transcript {
  text: string;
  confidence?: number;
  timestamp?: number;
}

export function VoiceContainer() {
  const [openaiApiKey] = useState("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")
  const [autoTTS, setAutoTTS] = useState(true)
  const [transcript, setTranscript] = useState<Transcript>({ text: "" })
  const [pendingTranscript, setPendingTranscript] = useState<string>("")

  // Memoize TTS config to prevent recreation on every render
  const ttsConfig = useMemo(() => ({
    apiKey: openaiApiKey,
    language: 'th-TH',
    voiceName: 'Sage', // Maps to 'alloy' in OpenAI
    onSuccess: () => {
      // Display transcript after TTS completes
      if (pendingTranscript) {
        setTranscript({
          text: pendingTranscript,
          timestamp: Date.now()
        });
        setPendingTranscript("");

        toast.success("เสียงเล่นเสร็จแล้ว", {
          description: "ข้อความแสดงผลแล้ว",
          duration: 2000,
        });
      } else {
        toast.success("เสียงเล่นเสร็จแล้ว", {
          duration: 2000,
        });
      }
    },
    onError: (error: string) => {
      console.error('TTS Error:', error)
      toast.error(`TTS Error: ${error}`, {
        duration: 4000,
      })

      // If TTS fails, still show the transcript
      if (pendingTranscript) {
        setTranscript({
          text: pendingTranscript,
          timestamp: Date.now()
        });
        setPendingTranscript("");
      }
    }
  }), [openaiApiKey, pendingTranscript])

  const {
    speaking: ttsPlaying,
    error: ttsError,
    speak,
    stop: stopTTS,
  } = useTTS(ttsConfig)

  // Webhook hook for sending transcribed text using neverthrow Result types
  const webhookMutation = useWebhook({
    onSuccess: (data) => {
      // Set transcript only after webhook succeeds
      if (webhookMutation.variables) {
        const originalText = webhookMutation.variables.msg;

        // Use webhook response for display and TTS if available, otherwise fall back to original
        const responseText = data.data?.output || data.data?.response || data.data?.text || data.data?.message || originalText;

        toast.success("แปลงเสียงสำเร็จ!", {
          description: `ได้ข้อความ: "${responseText.substring(0, 50)}${responseText.length > 50 ? '...' : ''}"`,
          duration: 3000,
        });

        // Use webhook response for TTS instead of original transcript
        if (autoTTS && responseText) {
          // Store text to display after TTS completes
          setPendingTranscript(responseText);
          speak(responseText);
        } else {
          // If auto TTS is off, display immediately
          setTranscript({
            text: responseText,
            timestamp: Date.now()
          });
        }
      }
    },
    onError: (error) => {
      // Error handling is done in the hook with enhanced error types
      console.error('Webhook failed:', error);
    }
  });

  const {
    recording,
    speaking,
    transcribing,
    error,
    startRecording,
    stopRecording,
  } = useSTT({
    apiKey: openaiApiKey,
    language: 'Thai',
    onSuccess: (newTranscript) => {
      // Don't show success toast here - wait for webhook success
      // Send to webhook using the mutation directly
      webhookMutation.mutate({ msg: newTranscript.text });
    },
    onError: (error: string) => {
      console.error('STT Error:', error)
      toast.error("การแปลงเสียงล้มเหลว", {
        description: error,
        duration: 4000,
      })
    }
  })

  const handleToggleRecording = async () => {
    if (recording) {
      stopRecording()
    } else {
      // Stop TTS if playing before starting recording
      if (ttsPlaying) {
        stopTTS()
      }
      // Clear previous transcript and pending transcript when starting new recording
      setTranscript({ text: "" })
      setPendingTranscript("")
      await startRecording()
    }
  }

  const handleToggleTTS = () => {
    if (ttsPlaying) {
      stopTTS()
    } else if (transcript.text) {
      speak(transcript.text)
    }
  }

  const getButtonIcon = () => {
    if (recording) {
      return <Square className="h-6 w-6" />
    }
    return <Mic className="h-6 w-6" />
  }

  const getButtonText = () => {
    if (transcribing) return "กำลังแปลงเสียง..."
    if (webhookMutation.isPending) return "กำลังส่งข้อมูล..."
    if (ttsPlaying) return "กำลังอ่านข้อความ..."
    if (recording) return "หยุดบันทึก"
    return "เริ่มบันทึกเสียง"
  }

  const getStatusBadge = () => {
    if (ttsPlaying) return <Badge variant="default">กำลังอ่านข้อความ</Badge>
    if (webhookMutation.isPending) return <Badge variant="secondary">กำลังส่งข้อมูล</Badge>
    if (transcribing) return <Badge variant="secondary">กำลังแปลงเสียง</Badge>
    if (recording && speaking) return <Badge variant="default">กำลังพูด</Badge>
    if (recording) return <Badge variant="outline">กำลังฟัง</Badge>
    return null
  }

  return (
    <div className="w-full max-w-2xl space-y-8">

      {/* Error Alert */}
      {(error || ttsError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || ttsError}
          </AlertDescription>
        </Alert>
      )}

      {/* Voice Waveform */}
      <div className="flex flex-col items-center space-y-6">
        <VoiceWaveform
          isActive={(recording && speaking) || ttsPlaying}
          className="h-16 px-8"
        />

        {/* Status Badge */}
        <div className="flex justify-center">
          {getStatusBadge()}
        </div>
      </div>

      {/* Central Recording Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleToggleRecording}
          disabled={transcribing || webhookMutation.isPending}
          size="lg"
          className={`
            w-24 h-24 rounded-full p-0 transition-all duration-200 transform hover:scale-105
            ${recording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-primary hover:bg-primary/90'
            }
            ${(speaking || ttsPlaying) ? 'animate-pulse' : ''}
          `}
        >
          {getButtonIcon()}
        </Button>
      </div>

      {/* Button Status Text */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {getButtonText()}
        </p>
      </div>

      {/* Transcript Display - Only shows after webhook success */}
      {transcript.text && (
        <Card className="w-full">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">ข้อความที่แปลงได้</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {transcript.text.split(' ').length} คำ
                  </Badge>
                  {/* TTS Controls */}
                  <Button
                    onClick={handleToggleTTS}
                    variant="outline"
                    size="sm"
                    disabled={!transcript.text}
                  >
                    {ttsPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  {/* Auto TTS Toggle */}
                  <Button
                    onClick={() => setAutoTTS(!autoTTS)}
                    variant={autoTTS ? "default" : "outline"}
                    size="sm"
                  >
                    Auto TTS
                  </Button>
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm leading-relaxed">
                  {transcript.text}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
