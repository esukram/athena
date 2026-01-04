import { useParams } from 'react-router-dom';

import { TrainingSession } from '../components/TrainingSession';

export const LectureTrainRandomized = () => {
  const { id, chapterId, questionId } = useParams<{
    id: string;
    chapterId?: string;
    questionId?: string;
  }>();

  return (
    <TrainingSession
      lectureId={id!}
      chapterId={chapterId}
      questionId={questionId}
      mode="randomized"
    />
  );
};
