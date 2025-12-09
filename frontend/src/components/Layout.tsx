import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-[#2b2b2b]">
      {/* Header fixo com logo */}
      <header className="fixed top-0 left-0 right-0 bg-[#c52e33] py-4 shadow-lg z-30">
        <div className="container mx-auto px-4 flex items-center justify-center">
          <img
            src="/Logo_branco_horizontal.png"
            alt="SANDECH iN! Logo"
            className="h-12"
          />
        </div>
      </header>

      <Sidebar />

      {/* Main content com margem superior para não ficar atrás do header */}
      <main className="md:ml-64 min-h-screen transition-all duration-300 pt-20">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};