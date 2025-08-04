'use client';

export default function CacheResetPage() {
  const handleCacheReset = () => {
    // Browser-Cache leeren
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // LocalStorage leeren
    localStorage.clear();
    
    // SessionStorage leeren
    sessionStorage.clear();
    
    // Seite neu laden
    window.location.href = '/settings/storage';
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-lg mx-auto text-center space-y-4">
        <h1 className="text-2xl font-bold">🧹 Cache Reset</h1>
        <p>
          Leert alle Browser-Caches und lädt die Settings-Seite neu.
        </p>
        <button 
          onClick={handleCacheReset}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Cache leeren und Settings neu laden
        </button>
      </div>
    </div>
  );
}