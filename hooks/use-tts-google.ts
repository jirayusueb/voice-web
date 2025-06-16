"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface TTSConfig {
  apiKey: string;
  language?: string;
  voiceName?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface TTSState {
  speaking: boolean;
  error: string | null;
}

// Google TTS voice mapping
const getGoogleVoice = (
  voiceName?: string,
  language?: string
): { name: string; languageCode: string } => {
  const lang = language?.toLowerCase() || "th-th";

  // Thai voices
  if (lang.includes("th")) {
    return {
      name: voiceName || "th-TH-Chirp3-HD-Achernar",
      languageCode: "th-TH",
    };
  }

  // English voices (fallback)
  return {
    name: "en-US-Standard-A",
    languageCode: "en-US",
  };
};

export function useTTSGoogle(config: TTSConfig) {
  const [state, setState] = useState<TTSState>({
    speaking: false,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const speak = useCallback(
    async (text: string) => {
      if (!config.apiKey) {
        const errorMessage = "ต้องใส่ Google Cloud API key";
        setState((prev) => ({ ...prev, error: errorMessage }));
        if (config.onError) {
          config.onError(errorMessage);
        }
        return;
      }

      if (!text.trim()) {
        const errorMessage = "ไม่มีข้อความให้อ่าน";
        setState((prev) => ({ ...prev, error: errorMessage }));
        if (config.onError) {
          config.onError(errorMessage);
        }
        return;
      }

      try {
        setState((prev) => ({ ...prev, speaking: true, error: null }));

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        const voice = getGoogleVoice(config.voiceName, config.language);

        const requestBody = {
          input: {
            markup: text,
          },
          voice: {
            languageCode: voice.languageCode,
            name: voice.name,
            voiceClone: {},
          },
          audioConfig: {
            audioEncoding: "MP3",
          },
        };

        // Prepare headers based on authentication method
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.apiKey}`;

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Google TTS API Error: ${response.status} - ${
              errorData.error?.message || response.statusText
            }`
          );
        }

        const data = await response.json();

        if (!data.audioContent) {
          throw new Error("ไม่ได้รับข้อมูลเสียงจาก Google TTS API");
        }

        // Decode base64 audio content (MP3 format)
        const audioData = atob(data.audioContent);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }

        // Create MP3 blob for browser playback
        const audioBlob = new Blob([audioArray], { type: "audio/mp3" });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Create and play audio element
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onloadeddata = () => {
          audio.play().catch((playError) => {
            console.error("Audio play error:", playError);
            setState((prev) => ({ ...prev, speaking: false }));
            if (config.onError) {
              config.onError(`เล่นเสียงไม่ได้: ${playError.message}`);
            }
          });
        };

        audio.onended = () => {
          setState((prev) => ({ ...prev, speaking: false }));
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;

          if (config.onSuccess) {
            config.onSuccess();
          }
        };

        audio.onerror = () => {
          setState((prev) => ({ ...prev, speaking: false }));
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;

          const errorMessage = "เล่นเสียงไม่ได้";
          if (config.onError) {
            config.onError(errorMessage);
          }
        };
      } catch (error) {
        setState((prev) => ({ ...prev, speaking: false }));

        if (error instanceof Error && error.name === "AbortError") {
          console.log("TTS request was cancelled");
          return;
        }

        const errorMessage =
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการสร้างเสียง";

        setState((prev) => ({ ...prev, error: errorMessage }));

        if (config.onError) {
          config.onError(errorMessage);
        }
      }
    },
    [
      config.apiKey,
      config.language,
      config.voiceName,
      config.onSuccess,
      config.onError,
    ]
  );

  const stop = useCallback(() => {
    // Cancel ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setState((prev) => ({ ...prev, speaking: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    ...state,
    speak,
    stop,
  };
}
