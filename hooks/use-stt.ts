"use client";

import { useState, useRef, useCallback } from "react";
import OpenAI from "openai";

interface STTConfig {
  apiKey: string;
  language?: string;
  onSuccess?: (transcript: { text: string; blob?: Blob }) => void;
  onError?: (error: string) => void;
}

interface STTState {
  recording: boolean;
  speaking: boolean;
  transcribing: boolean;
  transcript: { text: string; blob?: Blob };
  error: string | null;
}

export function useSTT(config: STTConfig) {
  const [state, setState] = useState<STTState>({
    recording: false,
    speaking: false,
    transcribing: false,
    transcript: { text: "" },
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingCheckRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis for speaking detection
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start speaking detection
      const checkSpeaking = () => {
        if (analyser) {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);

          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const isSpeaking = average > 10; // Threshold for speaking detection

          setState((prev) => ({ ...prev, speaking: isSpeaking }));
        }
      };

      speakingCheckRef.current = setInterval(checkSpeaking, 100);

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setState((prev) => ({ ...prev, recording: true }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "ไม่สามารถเริ่มบันทึกเสียงได้";
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));

      // Call onError callback if provided
      if (config.onError) {
        config.onError(errorMessage);
      }
    }
  }, [config.onError]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (speakingCheckRef.current) {
      clearInterval(speakingCheckRef.current);
      speakingCheckRef.current = null;
    }

    setState((prev) => ({ ...prev, recording: false, speaking: false }));
  }, []);

  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      if (!config.apiKey) {
        const errorMessage = "ต้องใส่ OpenAI API key";
        setState((prev) => ({ ...prev, error: errorMessage }));

        // Call onError callback if provided
        if (config.onError) {
          config.onError(errorMessage);
        }
        return;
      }

      setState((prev) => ({ ...prev, transcribing: true }));

      try {
        const openai = new OpenAI({
          apiKey: config.apiKey,
          dangerouslyAllowBrowser: true,
        });

        // Create a File object from the Blob for OpenAI API
        const audioFile = new File([audioBlob], "recording.webm", {
          type: "audio/webm",
        });

        const response = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
          language:
            config.language?.toLowerCase() === "thai" ? "th" : config.language,
        });

        const text = response.text;

        if (!text) {
          throw new Error("ไม่ได้รับข้อความที่แปลงจาก OpenAI Whisper");
        }

        const newTranscript = { text: text.trim(), blob: audioBlob };
        setState((prev) => ({
          ...prev,
          transcript: newTranscript,
          transcribing: false,
        }));

        // Call onSuccess callback if provided
        if (config.onSuccess) {
          config.onSuccess(newTranscript);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "การแปลงเสียงล้มเหลว";
        setState((prev) => ({
          ...prev,
          transcribing: false,
          error: errorMessage,
        }));

        // Call onError callback if provided
        if (config.onError) {
          config.onError(errorMessage);
        }
      }
    },
    [config.apiKey, config.language, config.onSuccess, config.onError]
  );

  return {
    ...state,
    startRecording,
    stopRecording,
  };
}
