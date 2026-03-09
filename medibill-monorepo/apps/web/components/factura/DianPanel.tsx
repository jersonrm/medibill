"use client";

import { useState } from "react";
import { marcarComoDescargada } from "@/app/actions/facturas";
import { generarFevXml } from "@/app/actions/fev";
import { enviarFacturaDian, consultarEstadoDian, descargarXmlFirmado, descargarPdfDian } from "@/app/actions/dian";
import DownloadRipsButton from "@/components/DownloadRipsButton";
import type { FacturaData } from "./types";

interface DianPanelProps {
  factura: FacturaData;
  accion: boolean;
  setAccion: (v: boolean) => void;
  onFacturaUpdate: (updates: Partial<FacturaData>) => void;
}

export default function DianPanel({ factura, accion, setAccion, onFacturaUpdate }: DianPanelProps) {
  const [estadoDianMsg, setEstadoDianMsg] = useState<string | null>(null);
  const paciente = factura.pacientes;

  const handleDescargarPDF = () => {
    window.open(`/api/factura-pdf/${factura.id}`, "_blank");
  };

  const handleGenerarFevXml = async () => {
    setAccion(true);
    try {
      const res = await generarFevXml(factura.id);
      if (!res.success) {
        alert(res.error);
        return;
      }
      const blob = new Blob([res.data.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `FEV_${factura.num_factura}_${res.data.cufe.substring(0, 12)}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al generar FEV XML:", error);
      alert("Error al generar el XML de factura electrónica.");
    } finally {
      setAccion(false);
    }
  };

  const handleEnviarDian = async () => {
    if (!confirm("¿Enviar esta factura a la DIAN?")) return;
    setAccion(true);
    setEstadoDianMsg(null);
    try {
      const res = await enviarFacturaDian(factura.id);
      if (res.success) {
        onFacturaUpdate({ estado_dian: "enviada", cufe: res.cufe, track_id_dian: res.trackId });
        setEstadoDianMsg(`Factura enviada. CUFE: ${res.cufe.substring(0, 24)}...`);
      } else {
        alert(res.error);
      }
    } catch (error) {
      console.error("Error enviando a DIAN:", error);
      alert("Error al enviar la factura a la DIAN.");
    } finally {
      setAccion(false);
    }
  };

  const handleConsultarEstadoDian = async () => {
    setAccion(true);
    try {
      const res = await consultarEstadoDian(factura.id);
      if (res.success) {
        onFacturaUpdate({ estado_dian: res.estadoDian });
        setEstadoDianMsg(res.mensaje);
      } else {
        alert(res.error);
      }
    } catch (error) {
      console.error("Error consultando estado DIAN:", error);
      alert("Error consultando el estado en la DIAN.");
    } finally {
      setAccion(false);
    }
  };

  const handleDescargarXmlFirmado = async () => {
    setAccion(true);
    try {
      const res = await descargarXmlFirmado(factura.id);
      if (res.success) {
        const blob = new Blob([res.xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `FEV_FIRMADO_${factura.num_factura}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(res.error);
      }
    } catch (error) {
      console.error("Error descargando XML firmado:", error);
      alert("Error al descargar el XML firmado.");
    } finally {
      setAccion(false);
    }
  };

  const handleDescargarPdfDian = async () => {
    setAccion(true);
    try {
      const res = await descargarPdfDian(factura.id);
      if (res.success) {
        const bytes = Uint8Array.from(atob(res.pdfBase64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `FEV_${factura.num_factura}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(res.error);
      }
    } catch (error) {
      console.error("Error descargando PDF DIAN:", error);
      alert("Error al descargar el PDF.");
    } finally {
      setAccion(false);
    }
  };

  const handleMarcarDescargada = async () => {
    setAccion(true);
    const res = await marcarComoDescargada(factura.id);
    if (res.success) {
      onFacturaUpdate({ estado: "descargada" });
    }
    setAccion(false);
  };

  return (
    <>
      {/* Botones de acción para estado aprobada */}
      {factura.estado === "aprobada" && (
        <>
          <button onClick={handleDescargarPDF} disabled={accion}
            className="px-6 py-3 bg-medi-primary text-white font-bold rounded-xl hover:bg-medi-deep transition-colors disabled:opacity-50 shadow-md">
            📄 Descargar PDF
          </button>
          <DownloadRipsButton facturaId={factura.id} />
          <button onClick={handleGenerarFevXml} disabled={accion}
            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-md">
            🧾 Generar FEV XML
          </button>
          {!factura.estado_dian && (
            <button onClick={handleEnviarDian} disabled={accion}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md">
              📤 Enviar a DIAN
            </button>
          )}
          <button onClick={handleMarcarDescargada} disabled={accion}
            className="px-6 py-3 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50 border border-blue-200">
            Marcar como descargada
          </button>
        </>
      )}

      {/* Panel estado DIAN */}
      {factura.estado_dian && (
        <div className="w-full mt-2">
          <div className={`rounded-xl border p-4 ${
            factura.estado_dian === "aceptada" ? "bg-green-50 border-green-300" :
            factura.estado_dian === "rechazada" ? "bg-red-50 border-red-300" :
            "bg-indigo-50 border-indigo-300"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-black uppercase text-medi-deep">Estado DIAN</h4>
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                factura.estado_dian === "aceptada" ? "bg-green-600 text-white" :
                factura.estado_dian === "rechazada" ? "bg-red-600 text-white" :
                factura.estado_dian === "enviada" ? "bg-indigo-600 text-white" :
                "bg-gray-400 text-white"
              }`}>
                {factura.estado_dian}
              </span>
            </div>
            {factura.cufe && (
              <p className="text-xs text-medi-dark/60 font-mono break-all mb-2">
                CUFE: {factura.cufe}
              </p>
            )}
            {estadoDianMsg && (
              <p className="text-xs text-medi-dark/70 mb-2">{estadoDianMsg}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {factura.estado_dian === "enviada" && (
                <button onClick={handleConsultarEstadoDian} disabled={accion}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  🔄 Consultar Estado
                </button>
              )}
              {(factura.estado_dian === "aceptada" || factura.estado_dian === "enviada") && (
                <>
                  <button onClick={handleDescargarXmlFirmado} disabled={accion}
                    className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    📥 XML Firmado
                  </button>
                  <button onClick={handleDescargarPdfDian} disabled={accion}
                    className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                    📄 PDF DIAN
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
