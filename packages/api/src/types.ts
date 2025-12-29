export interface Lecture {
  id: string;
  title: string;
  description: string;
}

export interface Chapter {
  id: string;
  lectureId: string;
  title: string;
  body: string;
  association: string;
  order: number;
}
