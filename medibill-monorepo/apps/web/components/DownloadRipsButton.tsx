'use client'

import { useState } from 'react';
import { generarJsonRipsMVP } from '../app/actions'; 
import { validadorRips } from '../lib/validadorRips'; 

interface Props {
  tipoDocumentoPaciente: string;
  documentoPaciente: string;
  fechaNacimientoPaciente: string;
  sexoPaciente: string;
  tipoUsuarioPaciente: string;
  diagnosticos: any[];
  procedimientos: any[];
  // 🟢 Objeto de liquidación sugerido por la IA y validado por el médico
  atencionIA: {
    modalidad: string;
    causa: string;
    finalidad: string;
    tipo_diagnostico: string;
    valor_consulta: number;
    valor_cuota: number;
  };
}

export default function DownloadRipsButton({ 
  tipoDocumentoPaciente,
  documentoPaciente, 
  fechaNacimientoPaciente,
  sexoPaciente,
  tipoUsuarioPaciente,
  diagnosticos, 
  procedimientos,
  atencionIA
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const ripsData = await generarJsonRipsMVP({ 
        tipoDocumentoPaciente,
        documentoPaciente, 
        fechaNacimientoPaciente,
        sexoPaciente,
        tipoUsuarioPaciente,
        diagnosticos, 
        procedimientos,
        atencionIA
      });
      
      const esValido = validadorRips(ripsData);

      if (!esValido) {
        console.error("❌ Error estructura RIPS 2275:", validadorRips.errors);
        alert("El archivo tiene errores. Revisa la consola para detalles.");
        setLoading(false);
        return; 
      }

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
      console.error("Error al generar RIPS:", error);
      alert("Error al generar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={loading}
      className="bg-medi-primary hover:bg-medi-deep text-white px-8 py-4 rounded-xl font-black text-lg flex items-center gap-3 shadow-lg shadow-medi-primary/30 transition-all active:scale-95 disabled:opacity-50"
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Generando...
        </span>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 9l2.25-2.25 2.25 2.25 2.25-2.25 2.25 2.25V21H3V3h18v18h-3" />
          </svg>
          GENERAR RIPS 2275
        </>
      )}
    </button>
  );
}