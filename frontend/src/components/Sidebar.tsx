import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileAudio, FileText, Menu, X } from 'lucide-react';

export const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    {
      path: '/',
      label: 'Transcrição',
      icon: <FileAudio className="w-5 h-5" />
    },
    {
      path: '/gerar-ata',
      label: 'Gerar Ata',
      icon: <FileText className="w-5 h-5" />
    }
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' ||
             location.pathname.startsWith('/processing') ||
             location.pathname.startsWith('/result');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-24 left-4 z-50 md:hidden bg-[#c52e33] text-white p-2 rounded-lg shadow-lg hover:bg-[#80000d] transition-colors"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <aside className={`
        fixed left-0 top-20 h-[calc(100vh-5rem)] w-64 bg-[#2b2b2b] text-white shadow-xl
        transform transition-transform duration-300 ease-in-out z-40
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-6">
          <h1 className="text-xl font-bold mb-8 flex items-center gap-2">
            <span className="text-[#c52e33]">SiN!</span> Tools
          </h1>

          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 p-3 rounded-lg transition-all duration-200
                  ${isActive(item.path)
                    ? 'bg-[#c52e33] text-white shadow-md'
                    : 'text-gray-300 hover:bg-[#3a3a3a] hover:text-white'}
                `}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 text-xs text-gray-500 text-center">
          Sistema de Transcrição - Powered by SANDECH iN!
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
