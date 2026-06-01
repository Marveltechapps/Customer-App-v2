import { api } from '../api/client';
import { endpoints } from '../api/endpoints';

export interface FaqItem {
  question: string;
  answer: string;
  order: number;
  category?: string;
}

interface FaqResponse {
  success: boolean;
  data: FaqItem[];
}

/** Fetch FAQ items for display in Help/Support screens */
export async function fetchFaq(): Promise<FaqItem[]> {
  const res = await api.get<FaqResponse>(endpoints.faq);
  return res.data ?? [];
}
