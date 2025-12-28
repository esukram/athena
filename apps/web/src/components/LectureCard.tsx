export interface LectureProps {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  duration: string;
}

export const LectureCard = ({ lecture }: { lecture: LectureProps }) => {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border border-gray-100">
      <div className="relative h-52 w-full overflow-hidden bg-gradient-to-br from-primary-100 to-primary-50">
        <div 
          className="h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundImage: `url(${lecture.imageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/95 text-primary-700 shadow-md backdrop-blur-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {lecture.duration}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col flex-1 p-6">
        <div className="flex-1 space-y-3">
          <h2 className="text-xl font-bold text-gray-900 leading-tight group-hover:text-primary-600 transition-colors duration-200">
            {lecture.title}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
            {lecture.description}
          </p>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button className="flex-1 px-4 py-2.5 text-sm font-semibold text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 active:bg-primary-200 transition-all duration-200 hover:shadow-md">
            Details
          </button>
          <button className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 transition-all duration-200 shadow-md hover:shadow-lg">
            Start
          </button>
        </div>
      </div>
    </div>
  );
};
