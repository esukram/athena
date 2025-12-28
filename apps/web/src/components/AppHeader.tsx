import { Link } from 'react-router-dom';

import logo from '../../assets/logo.png';

export const AppHeader = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-surface shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link
          to="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img
            src={logo}
            alt="Athena Logo"
            className="h-10 w-10 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            Athena
          </h1>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            to="/"
            className="text-base font-medium text-on-surface hover:text-primary-600 transition-colors"
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
