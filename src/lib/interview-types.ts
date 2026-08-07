export type Mission = {
  day: number;
  title: string;
  passed?: boolean;
  skipped?: boolean;
  attempts?: number;
};

export type CandidateMember = {
  id: string;
  name: string;
  jobRole: string;
  yearsExperience: number;
  education: string;
  status: string;
};

export type Candidate = {
  member: CandidateMember;
  missions: Mission[];
  signals: { commitDays: number; missionsCompleted: number; missionsFirstTry: number };
};

export type Feedback = {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
};

export type InterviewResponse = {
  reply: string;
  done: boolean;
  feedback?: Feedback;
  progress?: { questionsAsked: number; daysCovered: number[] };
};