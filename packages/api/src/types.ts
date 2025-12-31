export interface Lecture {
  id: string;
  title: string;
  description: string;
}

export interface Chapter {
  id: string;
  lectureId: string;
  association: string;
  order: number;
}

export interface Question {
  id: string;
  chapterId: string;
  question: string;
  answer: string;
  order: number;
  isAnnotated: boolean;
}
