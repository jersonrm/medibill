"use client";

import { useState } from "react";
import { obtenerFactura, editarFacturaBorrador } from "@/app/actions/facturas";
import { buscarCie10Action, buscarCupsAction } from "@/app/actions/busqueda-codigos";
import { formatCOP } from "@/lib/formato";
import ModalBusquedaCodigo from "@/components/ModalBusquedaCodigo";
import type { FacturaData } from "./types";

interface FacturaEditorProps {
  factura: FacturaData;
  onSaved: (updated: FacturaData) => void;
  onCancel: () => void;
}

export default function FacturaEditor({ factura, onSaved, onCancel }: FacturaEditorProps) {
  const [editGuardando, setEditGuardando] = useState(false);
  const [editDiags, setEditDiags] = useState<FacturaData["diagnosticos"]>(() => [...factura.diagnosticos]);
  const [editProcs, setEditProcs] = useState<FacturaData["procedimientos"]>(() => factura.procedimientos.map(p => ({ ...p })));
  const [editCopago, setEditCopago] = useState(factura.copago);
  const [editCuotaMod, setEditCuotaMod] = useState(factura.cuota_moderadora);
  const [editPaciente, setEditPaciente] = useState<NonNullable<FacturaData["pacientes"]>>(
    () => factura.pacientes ? { ...factura.pacientes } : { primer_nombre: "", primer_apellido: "", numero_documento: "", tipo_documento: "CC" }
  );
  const [modalCodigo, setModalCodigo] = useState<{ tipo: "cie10" | "cups"; abierto: boolean }>({ tipo: "cie10", abierto: false });

  const calcularTotalesEdit = () => {
    const subtotal = editProcs.reduce((s, p) => s + (p.valor_unitario || 0) * p.cantidad, 0);
    const valorTotal = subtotal - editCopago - editCuotaMod;
    return { subtotal, valorTotal: Math.max(0, valorTotal) };
  };

  const handleGuardarEdicion = async () => {
    setEditGuardando(true);
    const { subtotal, valorTotal } = calcularTotalesEdit();
    const res = await editarFacturaBorrador(factura.id, {
      diagnosticos: editDiags,
      procedimientos: editProcs,
      subtotal,
      copago: editCopago,
      cuota_moderadora: editCuotaMod,
      valor_total: valorTotal,
      datos_paciente: {
        tipo_documento: editPaciente.tipo_documento,
        numero_documento: editPaciente.numero_documento,
        primer_nombre: editPaciente.primer_nombre,
        segundo_nombre: editPaciente.segundo_nombre,
        primer_apellido: editPaciente.primer_apellido,
        segundo_apellido: editPaciente.segundo_apellido,
        fecha_nacimiento: editPaciente.fecha_nacimiento,
        sexo: editPaciente.sexo,
        tipo_usuario: editPaciente.tipo_usuario,
        eps_nombre: editPaciente.eps_nombre,
        municipio_residencia_codigo: editPaciente.municipio_residencia_codigo,
        zona_territorial: editPaciente.zona_territorial,
      },
    });
    if (res.success) {
      const data = await obtenerFactura(factura.id);
      if (data) onSaved(data as FacturaData);
    } else {
      alert(res.error);
    }
    setEditGuardando(false);
  };

  const handleBuscarCodigo = async (termino: string) => {
    if (modalCodigo.tipo === "cie10") {
      const res = await buscarCie10Action(termino);
      return res.map(r => ({ codigo: r.codigo, descripcion: r.descripcion }));
    } else {
      const res = await buscarCupsAction(termino);
      return res.map(r => ({ codigo: r.codigo, descripcion: r.descripcion }));
    }
  };

  const perfil = factura.perfil_prestador_snapshot as Record<string, string> | null;
  const { subtotal, valorTotal } = calcularTotalesEdit();

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos del prestador (solo lectura) */}
        <div className="bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm">
          <h3 className="text-xs font-black text-medi-dark uppercase mb-4">Prestador</h3>
          <div className="text-sm space-y-1 text-medi-deep">
            <p className="font-bold">{perfil?.razon_social || perfil?.nombre_completo || "—"}</p>
            <p>NIT: {factura.nit_prestador}</p>
            <p>{perfil?.direccion || ""}</p>
          </div>
        </div>

        {/* Datos del paciente (editable) */}
        <div className="bg-white rounded-2xl border border-medi-light/50 p-6 shadow-sm">
          <h3 className="text-xs font-black text-medi-dark uppercase mb-4">Paciente</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-medi-dark/60 mb-0.5">Primer nombre *</label>
                <input value={editPaciente.primer_nombre} onChange={e => setEditPaciente(p => ({ ...p, primer_nombre: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-medi-dark/60 mb-0.5">Segundo nombre</label>
                <input value={editPaciente.segundo_nombre || ""} onChange={e => setEditPaciente(p => ({ ...p, segundo_nombre: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-medi-dark/60 mb-0.5">Primer apellido *</label>
                <input value={editPaciente.primer_apellido} onChange={e => setEditPaciente(p => ({ ...p, primer_apellido: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-medi-dark/60 mb-0.5">Segundo apellido</label>
                <input value={editPaciente.segundo_apellido || ""} onChange={e => setEditPaciente(p => ({ ...p, segundo_apellido: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-medi-dark/60 mb-0.5">Tipo doc.</label>
                <select value={editPaciente.tipo_documento} onChange={e => setEditPaciente(p => ({ ...p, tipo_documento: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary">
                  <option value="CC">CC</option><option value="TI">TI</option><option value="CE">CE</option>
                  <option value="PA">PA</option><option value="RC">RC</option><option value="MS">MS</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-medi-dark/60 mb-0.5">Número doc. *</label>
                <input value={editPaciente.numero_documento} onChange={e => setEditPaciente(p => ({ ...p, numero_documento: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-medi-dark/60 mb-0.5">Sexo</label>
                <select value={editPaciente.sexo || ""} onChange={e => setEditPaciente(p => ({ ...p, sexo: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary">
                  <option value="">-</option><option value="M">Masculino</option><option value="F">Femenino</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-medi-dark/60 mb-0.5">Fecha nacimiento</label>
                <input type="date" value={editPaciente.fecha_nacimiento || ""} onChange={e => setEditPaciente(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-medi-dark/60 mb-0.5">EPS</label>
                <input value={editPaciente.eps_nombre || ""} onChange={e => setEditPaciente(p => ({ ...p, eps_nombre: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-medi-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnósticos (editable) */}
      <div className="bg-white rounded-2xl border border-medi-light/50 mt-6 overflow-hidden shadow-sm">
        <div className="bg-medi-deep px-6 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold uppercase text-sm tracking-wider">Diagnósticos (CIE-10)</h3>
          <button onClick={() => setModalCodigo({ tipo: "cie10", abierto: true })}
            className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors">+ Agregar</button>
        </div>
        <div className="p-4">
          {editDiags.map((d, i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-medi-light/30" : ""} ${d.manual ? "border-l-4 border-l-amber-400" : ""}`}>
              <span className="font-black text-medi-deep bg-medi-light/30 px-4 py-2 rounded-lg min-w-[90px] text-center text-sm">{d.codigo_cie10}</span>
              <span className="text-sm font-medium text-medi-deep flex-grow">{d.descripcion}</span>
              <div className="flex items-center gap-2">
                <select value={d.rol} onChange={e => {
                  const newDiags = [...editDiags];
                  newDiags[i] = { ...newDiags[i]!, rol: e.target.value };
                  setEditDiags(newDiags);
                }} className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-medi-primary">
                  <option value="principal">Principal</option>
                  <option value="relacionado">Relacionado</option>
                </select>
                <button onClick={() => setEditDiags(editDiags.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded hover:bg-red-50">✕</button>
              </div>
            </div>
          ))}
          {editDiags.length === 0 && (
            <p className="text-sm text-medi-dark/40 text-center py-4">Sin diagnósticos. Presione &quot;+ Agregar&quot; para añadir.</p>
          )}
        </div>
      </div>

      {/* Procedimientos (editable) */}
      <div className="bg-white rounded-2xl border border-medi-light/50 mt-6 overflow-hidden shadow-sm">
        <div className="bg-medi-primary px-6 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold uppercase text-sm tracking-wider">Procedimientos (CUPS)</h3>
          <button onClick={() => setModalCodigo({ tipo: "cups", abierto: true })}
            className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors">+ Agregar</button>
        </div>
        <div className="p-4">
          {editProcs.map((p, i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-medi-light/30" : ""} ${p.manual ? "border-l-4 border-l-amber-400" : ""}`}>
              <span className="font-black text-medi-primary bg-medi-light/30 px-4 py-2 rounded-lg min-w-[90px] text-center text-sm">{p.codigo_cups}</span>
              <span className="text-sm font-medium text-medi-deep flex-grow">{p.descripcion}</span>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <label className="text-[9px] text-medi-dark/50">Cant:</label>
                    <input type="number" min={1} value={p.cantidad} onChange={e => {
                      const newProcs = [...editProcs];
                      newProcs[i] = { ...newProcs[i]!, cantidad: Math.max(1, parseInt(e.target.value) || 1) };
                      setEditProcs(newProcs);
                    }} className="w-14 px-1 py-0.5 text-xs text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-medi-primary" />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-[9px] text-medi-dark/50">Valor:</label>
                    <input type="number" min={0} step="100" value={p.valor_unitario || ""} onChange={e => {
                      const newProcs = [...editProcs];
                      newProcs[i] = { ...newProcs[i]!, valor_unitario: parseFloat(e.target.value) || 0, fuente_tarifa: "manual" };
                      setEditProcs(newProcs);
                    }} className="w-24 px-1 py-0.5 text-xs text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-medi-primary" />
                  </div>
                </div>
                <button onClick={() => setEditProcs(editProcs.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded hover:bg-red-50">✕</button>
              </div>
            </div>
          ))}
          {editProcs.length === 0 && (
            <p className="text-sm text-medi-dark/40 text-center py-4">Sin procedimientos. Presione &quot;+ Agregar&quot; para añadir.</p>
          )}
        </div>
        {/* Totales (editable) */}
        <div className="border-t border-medi-light px-6 py-4 bg-medi-light/10">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-medi-dark/60">Subtotal</span>
            <span className="font-bold">{formatCOP(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-medi-dark/60">Copago</span>
            <input type="text" inputMode="numeric" value={editCopago === 0 ? "" : editCopago} placeholder="0"
              onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ""); setEditCopago(raw === "" ? 0 : parseInt(raw, 10)); }}
              className="w-32 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-medi-primary" />
          </div>
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-medi-dark/60">Cuota moderadora</span>
            <input type="text" inputMode="numeric" value={editCuotaMod === 0 ? "" : editCuotaMod} placeholder="0"
              onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ""); setEditCuotaMod(raw === "" ? 0 : parseInt(raw, 10)); }}
              className="w-32 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-medi-primary" />
          </div>
          <div className="flex justify-between text-lg mt-2 pt-2 border-t border-medi-light">
            <span className="font-black text-medi-deep">Total</span>
            <span className="font-black text-green-600">{formatCOP(valorTotal)}</span>
          </div>
        </div>
      </div>

      {/* Barra de edición (guardar/cancelar) */}
      <div className="mt-6 flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4">
        <span className="text-sm text-amber-800 font-medium flex-grow">✏️ Modo edición activo — los cambios se guardarán al presionar &quot;Guardar&quot;.</span>
        <button onClick={onCancel} disabled={editGuardando}
          className="px-5 py-2 text-sm font-bold bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-300 disabled:opacity-50">
          Cancelar
        </button>
        <button onClick={handleGuardarEdicion} disabled={editGuardando}
          className="px-5 py-2 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md disabled:opacity-50">
          {editGuardando ? "Guardando..." : "💾 Guardar cambios"}
        </button>
      </div>

      {/* Modal de búsqueda de códigos */}
      <ModalBusquedaCodigo
        tipo={modalCodigo.tipo}
        abierto={modalCodigo.abierto}
        onCerrar={() => setModalCodigo(prev => ({ ...prev, abierto: false }))}
        onSeleccionar={(codigo, descripcion) => {
          if (modalCodigo.tipo === "cie10") {
            setEditDiags(prev => [...prev, { codigo_cie10: codigo, descripcion, rol: prev.length === 0 ? "principal" : "relacionado", manual: true }]);
          } else {
            setEditProcs(prev => [...prev, { codigo_cups: codigo, descripcion, cantidad: 1, valor_unitario: 0, fuente_tarifa: "manual", manual: true }]);
          }
        }}
        buscar={handleBuscarCodigo}
      />
    </>
  );
}
