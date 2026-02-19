export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
  highlights?: Highlight[];
}

export interface Highlight {
  phrase: string;
  start: number;
  end: number;
  translation: string;
  level: string;
  color: string;
}

export interface Persona {
  name: string;
  filename: string;
  content: string;
}

export interface TranscriptResponse {
  video_id: string;
  segments: TranscriptSegment[];
  total_segments: number;
}

export interface PersonasResponse {
  personas: Persona[];
}

export interface Chapter {
  title: string;
  start_time: number;
  summary: string;
  segmentRange: [number, number];
}

export interface TocResponse {
  chapters: Chapter[];
}

export interface ContextNote {
  segment_index: number;
  type: "cultural" | "knowledge";
  title: string;
  note: string;
}

export interface ContextNotesResponse {
  notes: ContextNote[];
  total: number;
}
