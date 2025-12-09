import { createContext, useContext, useState, ReactNode } from 'react';

interface TranscriptionContextType {
  transcriptionText: string;
  setTranscriptionText: (text: string) => void;
  clearTranscription: () => void;
}

const TranscriptionContext = createContext<TranscriptionContextType | undefined>(undefined);

export const TranscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [transcriptionText, setTranscriptionText] = useState('');

  const clearTranscription = () => setTranscriptionText('');

  return (
    <TranscriptionContext.Provider value={{ transcriptionText, setTranscriptionText, clearTranscription }}>
      {children}
    </TranscriptionContext.Provider>
  );
};

export const useTranscription = () => {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error('useTranscription must be used within TranscriptionProvider');
  }
  return context;
};
