"use client";

import { useState, useRef, useCallback } from "react";

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
        const errorMessage = "ต้องใส่ Botnoi API key";
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

        // Map voice names to Botnoi speaker IDs

        const requestBody = {
          text: text,
          speaker: "1",
          volume: "1",
          speed: 1,
          type_media: "mp3",
          save_file: "true",
          language: "th",
        };

        const response = await fetch(
          "https://api-voice.botnoi.ai/openapi/v1/generate_audio",
          {
            method: "POST",
            headers: {
              "Botnoi-Token": config.apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: abortControllerRef.current?.signal,
          }
        );

        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          setState((prev) => ({ ...prev, speaking: false }));
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.json();

        // Botnoi API returns audio URL in the response
        const audioUrl = responseData.audio_url || responseData.url;

        if (!audioUrl) {
          throw new Error("ไม่ได้รับ URL เสียงจาก Botnoi API");
        }

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
