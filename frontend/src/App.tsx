import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TranscriptionProvider } from './contexts/TranscriptionContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Processing } from './pages/Processing';
import { Result } from './pages/Result';
import { GeraAta } from './pages/GeraAta';

function App() {
  return (
    <BrowserRouter>
      <TranscriptionProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/processing/:id" element={<Processing />} />
            <Route path="/result/:id" element={<Result />} />
            <Route path="/gerar-ata" element={<GeraAta />} />
          </Routes>
        </Layout>
      </TranscriptionProvider>
    </BrowserRouter>
  );
}

export default App;
