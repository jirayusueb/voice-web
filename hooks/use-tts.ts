"use client";

import { useState, useRef, useCallback } from "react";
import OpenAI from "openai";

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

export function useTTS(config: TTSConfig) {
  const [state, setState] = useState<TTSState>({
    speaking: false,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        const errorMessage = "ไม่มีข้อความให้อ่าน";
        setState((prev) => ({ ...prev, error: errorMessage }));

        if (config.onError) {
          config.onError(errorMessage);
        }
        return;
      }

      if (!config.apiKey) {
        const errorMessage = "ต้องใส่ OpenAI API key";
        setState((prev) => ({ ...prev, error: errorMessage }));

        if (config.onError) {
          config.onError(errorMessage);
        }
        return;
      }

      setState((prev) => ({ ...prev, error: null, speaking: true }));

      try {
        // Create abort controller for this request
        abortControllerRef.current = new AbortController();

        const openai = new OpenAI({
          apiKey: config.apiKey,
          dangerouslyAllowBrowser: true,
        });

        // Map voice names to OpenAI voices
        const getOpenAIVoice = (voiceName?: string): string => {
          const voiceMap: { [key: string]: string } = {
            Puck: "alloy",
            Kore: "echo",
            Nova: "nova",
            Shimmer: "shimmer",
            Onyx: "onyx",
            Fable: "fable",
            Sage: "sage",
          };

          return voiceMap[voiceName || "Sage"] || "alloy";
        };

        const response = await openai.audio.speech.create({
          model: "tts-1",
          voice: getOpenAIVoice(config.voiceName) as any,
          input: text,
        });

        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          setState((prev) => ({ ...prev, speaking: false }));
          return;
        }

        // Get the audio data as blob
        const audioBlob = await response.blob();

        if (!audioBlob) {
          throw new Error("ไม่ได้รับข้อมูลเสียงจาก OpenAI");
        }

        const audioUrl = URL.createObjectURL(audioBlob);

        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        // Create and play new audio
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setState((prev) => ({ ...prev, speaking: true }));
        };

        audio.onended = () => {
          setState((prev) => ({ ...prev, speaking: false }));
          URL.revokeObjectURL(audioUrl);

          if (config.onSuccess) {
            config.onSuccess();
          }
        };

        audio.onerror = () => {
          const errorMessage = "ไม่สามารถเล่นเสียงได้";
          setState((prev) => ({
            ...prev,
            speaking: false,
            error: errorMessage,
          }));
          URL.revokeObjectURL(audioUrl);

          if (config.onError) {
            config.onError(errorMessage);
          }
        };

        await audio.play();
      } catch (error) {
        // Don't report error if request was aborted (normal cancellation)
        if (abortControllerRef.current?.signal.aborted) {
          setState((prev) => ({ ...prev, speaking: false }));
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : "การสร้างเสียงล้มเหลว";
        setState((prev) => ({
          ...prev,
          speaking: false,
          error: errorMessage,
        }));

        if (config.onError) {
          config.onError(errorMessage);
        }
      }
    },
    [config]
  );

  const stop = useCallback(() => {
    // Abort any ongoing API request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setState((prev) => ({ ...prev, speaking: false }));
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
    }
  }, []);

  return {
    ...state,
    speak,
    stop,
    pause,
    resume,
  };
}
