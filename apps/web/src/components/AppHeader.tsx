import { Link } from 'react-router-dom';

import { GlobalSearch } from './GlobalSearch';
import appHeaderBg from '../../assets/app-header.png';

export const AppHeader = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-surface shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link
          to="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity px-4 py-2 rounded-lg bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${appHeaderBg})`, backgroundSize: '100%' }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-white ml-16">
            Athena
          </h1>
        </Link>

        <nav className="flex items-center gap-6">
          <GlobalSearch />
          <Link
            to="/"
            className="hidden sm:block text-base font-medium text-on-surface hover:text-primary-600 transition-colors"
          >
            Overview
          </Link>
          <Link
            to="/add-lecture"
            className="text-base font-medium text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition-colors"
          >
            Add Lecture
          </Link>
        </nav>
      </div>
    </header>
  );
};
