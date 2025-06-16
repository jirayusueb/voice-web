"use client";

import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Result, ok, err } from "neverthrow";

interface WebhookPayload {
  msg: string;
  sessionId: string;
}

interface WebhookResponse {
  data?: any;
  message?: string;
}

interface WebhookError {
  type: "network" | "http" | "timeout" | "unknown";
  message: string;
  status?: number;
}

interface WebhookConfig {
  onSuccess?: (data: WebhookResponse) => void;
  onError?: (error: WebhookError) => void;
}

const WEBHOOK_URL = "https://n8n.artid.dev/webhook/ai-thai-smile-bus";

// Function to send webhook request using neverthrow Result pattern
const sendWebhookRequest = async (
  payload: WebhookPayload
): Promise<Result<WebhookResponse, WebhookError>> => {
  try {
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 300000, // 5 minutes timeout
    });

    return ok({
      data: response.data,
      message: "Webhook sent successfully",
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // HTTP error response
        return err({
          type: "http",
          message: `HTTP ${error.response.status}: ${error.response.statusText}`,
          status: error.response.status,
        });
      } else if (error.request) {
        // Network error
        return err({
          type: "network",
          message: "ไม่สามารถเชื่อมต่อกับ webhook ได้",
        });
      } else if (error.code === "ECONNABORTED") {
        // Timeout error
        return err({
          type: "timeout",
          message: "การเชื่อมต่อ webhook หมดเวลา (5 นาที)",
        });
      }
    }

    // Unknown error
    return err({
      type: "unknown",
      message:
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
    });
  }
};

export function useWebhook(config?: WebhookConfig) {
  return useMutation({
    mutationFn: async (payload: WebhookPayload) => {
      const result = await sendWebhookRequest(payload);

      return result.match(
        (success) => success,
        (error) => {
          throw error; // Re-throw for React Query error handling
        }
      );
    },
    onSuccess: (data: WebhookResponse) => {
      toast.success("ส่งข้อมูลสำเร็จ", {
        description: "ส่งข้อความไปยัง webhook แล้ว",
        duration: 2000,
      });

      if (config?.onSuccess) {
        config.onSuccess(data);
      }
    },
    onError: (error: WebhookError) => {
      // Enhanced error messages based on error type
      const getErrorTitle = (type: WebhookError["type"]): string => {
        switch (type) {
          case "network":
            return "เครือข่ายขัดข้อง";
          case "http":
            return "เซิร์ฟเวอร์ตอบสนองผิดพลาด";
          case "timeout":
            return "หมดเวลาการเชื่อมต่อ";
          default:
            return "ส่งข้อมูลล้มเหลว";
        }
      };

      toast.error(getErrorTitle(error.type), {
        description: error.message,
        duration: 4000,
      });

      console.error("Webhook Error:", {
        type: error.type,
        message: error.message,
        status: error.status,
      });

      if (config?.onError) {
        config.onError(error);
      }
    },
  });
}
