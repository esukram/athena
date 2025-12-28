
import '@material/web/elevation/elevation.js';
import logo from '../../assets/logo.png';

export const AppHeader = () => {
  return (
    <header className="flex items-center px-4 py-3 bg-surface text-on-surface relative z-10">
      {/* 
        Using standard HTML/CSS for layout as Material 3 web components 
        do not have a direct TopAppBar React wrapper in this setup yet.
        Tailwind classes or inline styles can be used for layout.
        
        Colors should ideally come from M3 tokens, but for now we rely on standard
        Tailwind/CSS or system defaults. Assuming a light theme or base styles.
      */}
      <div className="flex items-center gap-3">
        <img 
          src={logo} 
          alt="Athena Logo" 
          className="h-10 w-10 object-contain"
          onError={(e) => {
             // Fallback if image fails to load, though file existence was confirmed
             e.currentTarget.style.display = 'none';
          }}
        />
        <h1 className="text-2xl font-bold tracking-tight">Athena</h1>
      </div>
      
      {/* Elevation for the header */}
      <md-elevation></md-elevation>
    </header>
  );
};
