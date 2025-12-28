export interface Lecture {
  id: string;
  title: string;
  subtitle: string;
  description: string;
}

export interface Chapter {
  id: string;
  lectureId: string;
  title: string;
  order: number;
}
