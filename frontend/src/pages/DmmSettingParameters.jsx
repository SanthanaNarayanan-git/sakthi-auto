import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, CheckCircle, AlertTriangle, Save, Loader, FileDown, PlusCircle, Trash2, Calendar, Monitor } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const NotificationModal = ({ data, onClose }) => {
  if (!data.show) return null;
  const isError = data.type === 'error';
  const isLoading = data.type === 'loading';
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`border-2 w-full max-w-md p-6 rounded-2xl shadow-2xl bg-white ${isError ? 'border-red-200' : 'border-green-200'}`}>
        <div className="flex items-center gap-4">
           {isLoading ? <Loader className="animate-spin text-orange-600" /> : isError ? <AlertTriangle className="text-red-600" /> : <CheckCircle className="text-green-600" />}
           <div>
             <h3 className="font-bold text-lg">{isLoading ? 'Processing...' : isError ? 'Error' : 'Success'}</h3>
             <p className="text-sm text-gray-600">{data.message}</p>
           </div>
        </div>
        {!isLoading && <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded text-sm font-bold float-right hover:bg-orange-600 transition-colors">Close</button>}
      </div>
    </div>
  );
};

const getShiftDate = () => {
  const now = new Date();
  if (now.getHours() < 7) now.setDate(now.getDate() - 1);
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const columns = [
  { key: 'Customer', label: 'CUSTOMER', width: 'w-32', inputType: 'text' },
  { key: 'ItemDescription', label: 'ITEM\nDESCRIPTION', width: 'w-40', inputType: 'text' },
  { key: 'Time', label: 'TIME', width: 'w-24', inputType: 'time' },
  { key: 'PpThickness', label: 'PP\nTHICKNESS\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'PpHeight', label: 'PP\nHEIGHT\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'SpThickness', label: 'SP\nTHICKNESS\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'SpHeight', label: 'SP\nHEIGHT\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'CoreMaskOut', label: 'CORE MASK\nHEIGHT\n(OUTSIDE) mm', width: 'w-24', inputType: 'number' },
  { key: 'CoreMaskIn', label: 'CORE MASK\nHEIGHT\n(INSIDE) mm', width: 'w-24', inputType: 'number' },
  { key: 'SandShotPressure', label: 'SAND SHOT\nPRESSURE\nBAR', width: 'w-24', inputType: 'number', step: '0.01' },
  { key: 'CorrectionShotTime', label: 'CORRECTION\nOF SHOT TIME\n(SEC)', width: 'w-28', inputType: 'number' },
  { key: 'SqueezePressure', label: 'SQUEEZE\nPRESSURE\nKg/Cm2 / bar', width: 'w-28', inputType: 'number' },
  { key: 'PpStripAccel', label: 'PP STRIPPING\nACCELERATION', width: 'w-28', inputType: 'number' },
  { key: 'PpStripDist', label: 'PP STRIPPING\nDISTANCE', width: 'w-28', inputType: 'number' },
  { key: 'SpStripAccel', label: 'SP STRIPPING\nACCELERATION', width: 'w-28', inputType: 'number' },
  { key: 'SpStripDist', label: 'SP STRIPPING\nDISTANCE', width: 'w-28', inputType: 'number' },
  { key: 'MouldThickness', label: 'MOULD\nTHICKNESS\n(± 10mm)', width: 'w-28', inputType: 'number' },
  { key: 'CloseUpForce', label: 'CLOSE UP\nFORCE (Kg)', width: 'w-24', inputType: 'number' },
  { key: 'Remarks', label: 'REMARKS', width: 'w-48', inputType: 'text' }
];

const createEmptyRow = () => ({
  id: crypto.randomUUID(), 
  Customer: '', ItemDescription: '', Time: '', PpThickness: '', PpHeight: '',
  SpThickness: '', SpHeight: '', CoreMaskOut: '', CoreMaskIn: '', SandShotPressure: '',
  CorrectionShotTime: '', SqueezePressure: '', PpStripAccel: '', PpStripDist: '',
  SpStripAccel: '', SpStripDist: '', MouldThickness: '', CloseUpForce: '', Remarks: ''
});

const DmmSettingParameters = () => {
  const [headerData, setHeaderData] = useState({ date: getShiftDate(), disaMachine: 'DISA - I' });
  const [shiftsMeta, setShiftsMeta] = useState({ 
      1: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false }, 
      2: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false }, 
      3: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false } 
  });
  const [shiftsData, setShiftsData] = useState({ 1: [createEmptyRow()], 2: [createEmptyRow()], 3: [createEmptyRow()] });
  
  const [dropdowns, setDropdowns] = useState({ operators: [], supervisors: [] });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  useEffect(() => { fetchData(); }, [headerData.date, headerData.disaMachine]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/dmm-settings/details', { 
          params: { date: headerData.date, disa: headerData.disaMachine } 
      });
      
      setDropdowns({ operators: res.data.operators, supervisors: res.data.supervisors });
      
      if (res.data.shiftsMeta) {
          const loadedMeta = { ...shiftsMeta };
          for (let i = 1; i <= 3; i++) {
              if (res.data.shiftsMeta[i]) loadedMeta[i] = res.data.shiftsMeta[i];
          }
          setShiftsMeta(loadedMeta);
      }

      const loadedData = { 1: [], 2: [], 3: [] };
      [1, 2, 3].forEach(shift => {
          if (res.data.shiftsData[shift] && res.data.shiftsData[shift].length > 0) {
              loadedData[shift] = res.data.shiftsData[shift].map(row => ({ ...row, id: crypto.randomUUID() }));
          } else {
              loadedData[shift] = [createEmptyRow()];
          }
      });
      setShiftsData(loadedData);

    } catch (error) { setNotification({ show: true, type: 'error', message: "Failed to load data." }); }
    setLoading(false);
  };

  const handleMetaChange = (shift, field, value) => {
    setShiftsMeta(prev => ({ ...prev, [shift]: { ...prev[shift], [field]: value } }));
  };

  const handleInputChange = (shift, rowId, key, value) => {
    setShiftsData(prev => ({ ...prev, [shift]: prev[shift].map(row => row.id === rowId ? { ...row, [key]: value } : row) }));
  };

  const addRow = (shift) => { setShiftsData(prev => ({ ...prev, [shift]: [...prev[shift], createEmptyRow()] })); };

  const removeRow = (shift, rowId) => {
    setShiftsData(prev => ({ ...prev, [shift]: prev[shift].length > 1 ? prev[shift].filter(row => row.id !== rowId) : prev[shift] }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/dmm-settings/save', {
        date: headerData.date, disa: headerData.disaMachine, shiftsData, shiftsMeta
      });
      setNotification({ show: true, type: 'success', message: 'Parameters Assigned to Supervisor Successfully!' });
      setTimeout(() => setNotification({ show: false }), 3000);
      fetchData();
    } catch (error) { setNotification({ show: true, type: 'error', message: 'Failed to save data.' }); }
    setLoading(false);
  };

  const generatePDF = () => {
    setNotification({ show: true, type: 'loading', message: 'Generating PDF...' });

    try {
      const doc = new jsPDF('l', 'mm', 'a4'); 

      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI AUTO COMPONENT LIMITED", 148.5, 10, { align: 'center' });
      doc.setFontSize(16); doc.text("DMM SETTING PARAMETERS CHECK SHEET", 148.5, 18, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(` ${headerData.disaMachine}`, 10, 28);
      doc.text(`DATE: ${new Date(headerData.date).toLocaleDateString('en-GB')}`, 280, 28, { align: 'right' });

      // 🔥 Added placeholders for dynamic drawing of signatures
      autoTable(doc, {
        startY: 32, margin: { left: 10, right: 10 }, 
        head: [['SHIFT', 'OPERATOR NAME', 'VERIFIED BY', 'SIGNATURE']],
        body: [
            ['SHIFT I', shiftsMeta[1].operator || '-', shiftsMeta[1].supervisor || '-', ''],
            ['SHIFT II', shiftsMeta[2].operator || '-', shiftsMeta[2].supervisor || '-', ''],
            ['SHIFT III', shiftsMeta[3].operator || '-', shiftsMeta[3].supervisor || '-', '']
        ],
        theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        didDrawCell: function (data) {
           // 🔥 Draws the signature image dynamically into the signature column
           if (data.section === 'body' && data.column.index === 3) {
               const shiftNum = data.row.index + 1;
               const sigData = shiftsMeta[shiftNum]?.supervisorSignature;
               if (sigData && sigData.startsWith('data:image')) {
                   try { doc.addImage(sigData, 'PNG', data.cell.x + 2, data.cell.y + 1, data.cell.width - 4, data.cell.height - 2); } catch (e) {}
               }
           }
        }
      });

      let currentY = doc.lastAutoTable.finalY + 8; 

      [1, 2, 3].forEach((shift, index) => {
         const isIdle = shiftsMeta[shift].isIdle;
         const shiftLabel = shift === 1 ? 'I' : shift === 2 ? 'II' : 'III';

         const tableHeader = [
            [{ content: `SHIFT ${shiftLabel}`, colSpan: columns.length + 1, styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [0,0,0] } }],
            [{ content: 'S.No', styles: { cellWidth: 8 } }, ...columns.map(col => ({ content: col.label, styles: { cellWidth: 'wrap' } }))]
         ];

         let tableBody = [];
         if (isIdle) {
            tableBody.push([{ content: 'L I N E   I D L E', colSpan: columns.length + 1, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 14, textColor: [100, 100, 100], fillColor: [245, 245, 245], minCellHeight: 15 } }]);
         } else {
            tableBody = shiftsData[shift].map((row, idx) => {
                const pdfRow = [(idx + 1).toString()];
                columns.forEach(col => {
                    const val = row[col.key];
                    pdfRow.push(val === '' || val === null || val === undefined ? '-' : val.toString());
                });
                return pdfRow;
            });
         }

         autoTable(doc, {
            startY: currentY, margin: { left: 5, right: 5 }, head: tableHeader, body: tableBody, theme: 'grid',
            styles: { fontSize: 5.5, cellPadding: 0.8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 25 }, 2: { cellWidth: 28 }, 19: { cellWidth: 'auto' } }
         });

         currentY = doc.lastAutoTable.finalY + 5; 
         if (currentY > 175 && index < 2) {
             doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
             doc.addPage(); currentY = 15;
         }
      });

      doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
      doc.save(`DMM_Setting_Parameters_${headerData.date}.pdf`);
      setNotification({ show: false, type: '', message: '' });

    } catch (error) { setNotification({ show: true, type: 'error', message: `PDF Generation Failed: ${error.message}` }); }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 flex justify-center pb-24">
      <NotificationModal data={notification} onClose={() => setNotification({ ...notification, show: false })} />
      <div className="w-full max-w-[1700px] bg-white shadow-xl rounded-2xl flex flex-col overflow-hidden">
        
        <div className="bg-gray-900 py-6 px-8 flex justify-between items-center rounded-t-2xl">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2"><span className="text-orange-500 text-2xl">⚙️</span> DMM Setting Parameters</h2>
          <div className="flex items-center gap-3">
             <select value={headerData.disaMachine} onChange={(e) => setHeaderData({...headerData, disaMachine: e.target.value})} className="bg-gray-800 text-white font-bold border-2 border-orange-500 rounded-md p-2 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="DISA - I">DISA - I</option><option value="DISA - II">DISA - II</option><option value="DISA - III">DISA - III</option><option value="DISA - IV">DISA - IV</option>
             </select>
             <span className="text-orange-400 text-lg font-black uppercase tracking-wider">Date:</span>
             <div className="bg-gray-100 text-gray-600 font-bold border-2 border-gray-400 rounded-md p-2 text-lg cursor-not-allowed shadow-inner select-none">{new Date(headerData.date).toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        <div className="p-6 overflow-x-auto min-h-[400px] custom-scrollbar">
          <table className="w-full min-w-max border-collapse text-xs text-center table-fixed">
            <thead className="bg-gray-100">
              <tr className="text-[10px] text-gray-600 uppercase tracking-wide border-y-2 border-orange-200">
                <th className="border border-gray-300 p-2 w-10 sticky left-0 bg-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">S.No</th>
                {columns.map((col, idx) => (<th key={idx} className={`border border-gray-300 p-2 align-middle whitespace-pre-wrap ${col.width}`}>{col.label}</th>))}
                <th className="border border-gray-300 p-2 w-12 sticky right-0 bg-gray-200 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">DEL</th>
              </tr>
            </thead>
            <tbody className="text-sm font-semibold text-slate-800">
              {[1, 2, 3].map(shift => {
                const isIdle = shiftsMeta[shift].isIdle;
                return (
                  <React.Fragment key={`shift-${shift}`}>
                    <tr className="bg-orange-50/50 border-y-2 border-orange-200">
                      <td colSpan={columns.length + 2} className="p-3 text-left sticky left-0 z-0">
                         <div className="flex items-center justify-between w-[850px]">
                            <div className="flex items-center gap-6">
                                <span className="font-black text-gray-800 text-lg">SHIFT {shift}</span>
                                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded border-2 border-gray-300 hover:border-orange-500 transition-colors shadow-sm">
                                   <input type="checkbox" checked={isIdle} onChange={(e) => handleMetaChange(shift, 'isIdle', e.target.checked)} className="w-4 h-4 accent-orange-600 cursor-pointer" />
                                   <span className="text-xs font-bold text-gray-700 uppercase">Line Idle</span>
                                </label>
                                <div className={`flex items-center gap-2 transition-opacity ${isIdle ? 'opacity-40 pointer-events-none' : ''}`}>
                                   <span className="text-xs font-bold text-gray-600 uppercase">Operator:</span>
                                   <select value={shiftsMeta[shift].operator} onChange={(e) => handleMetaChange(shift, 'operator', e.target.value)} className="p-1.5 rounded border-2 border-gray-300 bg-white text-xs font-bold outline-none focus:border-orange-500">
                                      <option value="">Select...</option>{dropdowns.operators.map((o, i) => <option key={i} value={o.OperatorName}>{o.OperatorName}</option>)}
                                   </select>
                                </div>
                                <div className={`flex items-center gap-2 transition-opacity ${isIdle ? 'opacity-40 pointer-events-none' : ''}`}>
                                   <span className="text-xs font-bold text-gray-600 uppercase">Supervisor:</span>
                                   <select value={shiftsMeta[shift].supervisor} onChange={(e) => handleMetaChange(shift, 'supervisor', e.target.value)} className="p-1.5 rounded border-2 border-gray-300 bg-white text-xs font-bold outline-none focus:border-orange-500">
                                      <option value="">Select...</option>{dropdowns.supervisors.map((s, i) => <option key={i} value={s.supervisorName}>{s.supervisorName}</option>)}
                                   </select>
                                </div>
                            </div>
                            <button onClick={() => addRow(shift)} disabled={isIdle} className={`flex items-center gap-1 border-2 px-3 py-1.5 rounded transition-all shadow-sm text-xs font-bold uppercase ${isIdle ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed' : 'bg-white border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white'}`}>
                               <PlusCircle className="w-4 h-4" /> Add Row
                            </button>
                         </div>
                      </td>
                    </tr>
                    {shiftsData[shift].map((row, index) => (
                      <tr key={row.id} className={`h-12 transition-all ${isIdle ? 'bg-gray-100/50 opacity-40 grayscale pointer-events-none select-none' : 'hover:bg-orange-50/20 group'}`}>
                        <td className={`border border-gray-300 font-bold text-gray-600 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isIdle ? 'bg-gray-200/50' : 'bg-gray-50 group-hover:bg-orange-50/80'}`}>{index + 1}</td>
                        {columns.map(col => (
                          <td key={col.key} className="border border-gray-300 p-0 relative">
                            <input type={col.inputType} step={col.step || undefined} disabled={isIdle} value={isIdle ? '' : row[col.key]} onChange={(e) => handleInputChange(shift, row.id, col.key, e.target.value)} className={`absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-800 outline-none px-1 ${isIdle ? 'bg-transparent cursor-not-allowed' : 'bg-transparent focus:bg-orange-100 focus:ring-inset focus:ring-2 focus:ring-orange-500'}`} />
                          </td>
                        ))}
                        <td className={`border border-gray-300 sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isIdle ? 'bg-gray-200/50' : 'bg-gray-50 group-hover:bg-orange-50/80'}`}>
                           <button onClick={() => removeRow(shift, row.id)} disabled={isIdle} className="text-gray-400 hover:text-red-600 transition-colors mx-auto block disabled:opacity-0"><Trash2 className="w-5 h-5" /></button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div id="checklist-footer" className="bg-slate-100 p-8 border-t border-gray-200 sticky bottom-0 z-20 flex justify-end gap-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
           <button onClick={generatePDF} className="bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-200 font-bold py-3 px-6 rounded-lg shadow-md uppercase flex items-center gap-2 mt-auto transition-colors"><FileDown size={20} /> PDF</button>
           <button onClick={handleSave} disabled={loading} className="bg-gray-900 hover:bg-orange-600 text-white font-bold py-3 px-12 rounded-lg shadow-lg uppercase mt-auto transition-colors flex items-center gap-3">
             {loading ? <Loader className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}{loading ? 'Saving...' : 'Send to Supervisor'}
           </button>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        input[type=time]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}} />
    </div>
  );
};

export default DmmSettingParameters;