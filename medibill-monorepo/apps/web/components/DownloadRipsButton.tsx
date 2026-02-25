'use client'

import { useState } from 'react';
import { generarJsonRipsMVP } from '../app/actions'; 

interface Props {
  documentoPaciente: string;
  diagnosticos: any[];
  procedimientos: any[];
}

export default function DownloadRipsButton({ documentoPaciente, diagnosticos, procedimientos }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const ripsData = await generarJsonRipsMVP({ documentoPaciente, diagnosticos, procedimientos });
      const jsonString = JSON.stringify(ripsData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `RIPS_2275_${new Date().getTime()}.json`; 
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al generar el RIPS:", error);
      alert("Hubo un error al generar el archivo JSON.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={loading}
      className="border-2 border-medi-primary text-medi-primary hover:bg-medi-primary hover:text-white px-6 py-4 rounded-xl font-black text-lg flex items-center gap-3 shadow-md transition-all active:scale-95 disabled:opacity-50 bg-white"
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Generando JSON...</span>
        </div>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 9l2.25-2.25 2.25 2.25 2.25-2.25 2.25 2.25V21H3V3h18v18h-3" />
          </svg>
          JSON RIPS
        </>
      )}
    </button>
  );
}