import '@material/web/labs/card/elevated-card.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';

export interface LectureProps {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  duration: string;
}

export const LectureCard = ({ lecture }: { lecture: LectureProps }) => {
  return (
    <md-elevated-card className="p-4 flex flex-col gap-4 max-w-sm rounded-[12px] bg-surface-container-low">
      <div 
        className="h-40 w-full bg-cover bg-center rounded-lg"
        style={{ backgroundImage: `url(${lecture.imageUrl})` }}
      />
      
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-on-surface">{lecture.title}</h2>
        <p className="text-on-surface-variant text-sm line-clamp-2">{lecture.description}</p>
        <span className="text-label-medium text-primary">{lecture.duration}</span>
      </div>

      <div className="flex justify-end gap-2 mt-auto">
        <md-outlined-button>Details</md-outlined-button>
        <md-filled-button>Start</md-filled-button>
      </div>
    </md-elevated-card>
  );
};
