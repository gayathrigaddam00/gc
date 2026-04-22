import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface DetectionResult {
  url: string;
  found: boolean;
  confidence: number;
  method: "static" | "headless" | "llm" | "none";
  html_snippet: string | null;
  detected_fields: string[];
  form_action: string | null;
  fallback_reason: string | null;
  bot_protection: boolean;
  error: string | null;
}

export async function detectAuth(url: string): Promise<DetectionResult> {
  const response = await axios.post<DetectionResult>(`${API_URL}/detect`, { url });
  return response.data;
}
