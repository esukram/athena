import logo from '../../assets/logo.png';

export const AppHeader = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-surface shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
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
        </div>

        <nav className="flex items-center gap-6">
          <a
            href="/"
            className="text-base font-medium text-on-surface hover:text-primary-600 transition-colors"
          >
            Overview
          </a>
        </nav>
      </div>
    </header>
  );
};
