import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CheckCircle, AlertTriangle, Save, Loader, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';

const NotificationModal = ({ data, onClose }) => {
  if (!data.show) return null;
  const isError = data.type === 'error';
  const isLoading = data.type === 'loading';
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`border-2 w-full max-w-md p-6 rounded-2xl shadow-2xl bg-white ${isError ? 'border-red-200' : 'border-green-200'}`}>
        <div className="flex items-center gap-4">
           {isLoading ? <Loader className="animate-spin text-blue-600" /> : isError ? <AlertTriangle className="text-red-600" /> : <CheckCircle className="text-green-600" />}
           <div>
             <h3 className="font-bold text-lg">{isLoading ? 'Processing...' : isError ? 'Error' : 'Success'}</h3>
             <p className="text-sm text-gray-600">{data.message}</p>
           </div>
        </div>
        {!isLoading && <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded text-sm font-bold float-right">Close</button>}
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
  { key: 'patternChange', label: 'PATTERN\nCHANGE', group: 'MOULDING' },
  { key: 'heatCodeChange', label: 'HEAT CODE\nCHANGE', group: 'MOULDING' },
  { key: 'mouldBroken', label: 'MOULD\nBROKEN', group: 'MOULDING' },
  { key: 'amcCleaning', label: 'AMC\nCLEANING', group: 'MOULDING' },
  { key: 'mouldCrush', label: 'MOULD\nCRUSH', group: 'MOULDING' },
  { key: 'coreFalling', label: 'CORE\nFALLING', group: 'MOULDING', isLastInGroup: true },
  { key: 'sandDelay', label: 'SAND\nDELAY', group: 'SAND PLANT' },
  { key: 'drySand', label: 'DRY\nSAND', group: 'SAND PLANT', isLastInGroup: true },
  { key: 'nozzleChange', label: 'NOZZLE\nCHANGE', group: 'PREESPOUR' },
  { key: 'nozzleLeakage', label: 'NOZZLE\nLEAKAGE', group: 'PREESPOUR' },
  { key: 'spoutPocking', label: 'SPOUT\nPOCKING', group: 'PREESPOUR' },
  { key: 'stRod', label: 'ST\nROD', group: 'PREESPOUR', isLastInGroup: true },
  { key: 'qcVent', label: 'QC\nVENT', group: 'QUALITY CONTROL' },
  { key: 'outMould', label: 'OUT\nMOULD', group: 'QUALITY CONTROL' },
  { key: 'lowMg', label: 'LOW\nMG', group: 'QUALITY CONTROL' },
  { key: 'gradeChange', label: 'GRADE\nCHANGE', group: 'QUALITY CONTROL' },
  { key: 'msiProblem', label: 'MSI\nPROBLEM', group: 'QUALITY CONTROL', isLastInGroup: true },
  { key: 'brakeDown', label: 'BRAKE\nDOWN', group: 'MAINTENANCE', isLastInGroup: true },
  { key: 'wom', label: 'WOM', group: 'FURNACE', isLastInGroup: true },
  { key: 'devTrail', label: 'DEV\nTRAIL', group: 'TOOLING', isLastInGroup: true },
  { key: 'powerCut', label: 'POWER\nCUT', group: 'OTHERS' },
  { key: 'plannedOff', label: 'PLANNED\nOFF', group: 'OTHERS' },
  { key: 'vatCleaning', label: 'VAT\nCLEANING', group: 'OTHERS' },
  { key: 'others', label: 'OTHERS', group: 'OTHERS', isLastInGroup: true }
];

const emptyShift = columns.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {});
emptyShift.operatorSignature = '';

const UnPouredMouldDetails = () => {
  const [headerData, setHeaderData] = useState({ date: getShiftDate(), disaMachine: 'DISA - I' });
  const [shiftsData, setShiftsData] = useState({ 1: { ...emptyShift }, 2: { ...emptyShift }, 3: { ...emptyShift } });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  const sigRefs = {
    1: useRef(null),
    2: useRef(null),
    3: useRef(null)
  };

  useEffect(() => { fetchData(); }, [headerData.date, headerData.disaMachine]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/unpoured-moulds/details', { 
          params: { date: headerData.date, disa: headerData.disaMachine } 
      });
      
      const loadedData = { 1: { ...emptyShift }, 2: { ...emptyShift }, 3: { ...emptyShift } };
      
      [1, 2, 3].forEach(shift => {
          if (res.data[shift]) {
             columns.forEach(col => {
                 loadedData[shift][col.key] = res.data[shift][col.key.charAt(0).toUpperCase() + col.key.slice(1)] || '';
             });
             loadedData[shift].operatorSignature = res.data[shift].OperatorSignature || '';
             
             if (loadedData[shift].operatorSignature && sigRefs[shift].current) {
                sigRefs[shift].current.fromDataURL(loadedData[shift].operatorSignature);
             } else if (sigRefs[shift].current) {
                sigRefs[shift].current.clear();
             }
          } else {
             if (sigRefs[shift].current) sigRefs[shift].current.clear();
          }
      });
      setShiftsData(loadedData);
    } catch (error) { 
      setNotification({ show: true, type: 'error', message: "Failed to load data." });
    }
    setLoading(false);
  };

  const handleInputChange = (shift, key, value) => {
    setShiftsData(prev => ({
      ...prev,
      [shift]: { ...prev[shift], [key]: value }
    }));
  };

  const clearSignature = (shift) => {
    if (sigRefs[shift].current) {
      sigRefs[shift].current.clear();
      handleInputChange(shift, 'operatorSignature', '');
    }
  };

  const getRowTotal = (shift) => {
    return columns.reduce((sum, col) => sum + (parseInt(shiftsData[shift][col.key]) || 0), 0);
  };

  const getColTotal = (key) => {
    return [1, 2, 3].reduce((sum, shift) => sum + (parseInt(shiftsData[shift][key]) || 0), 0);
  };

  const getGrandTotal = () => {
    return [1, 2, 3].reduce((sum, shift) => sum + getRowTotal(shift), 0);
  };

  const handleSave = async () => {
    setLoading(true);
    const payloadData = { ...shiftsData };
    
    [1, 2, 3].forEach(s => { 
      payloadData[s].rowTotal = getRowTotal(s); 
      
      if (sigRefs[s].current && !sigRefs[s].current.isEmpty()) {
        payloadData[s].operatorSignature = sigRefs[s].current.getCanvas().toDataURL('image/png');
      } else {
        payloadData[s].operatorSignature = '';
      }
    });

    try {
      await axios.post('http://localhost:5000/api/unpoured-moulds/save', {
        date: headerData.date,
        disa: headerData.disaMachine,
        shiftsData: payloadData
      });
      setNotification({ show: true, type: 'success', message: 'Data Saved Successfully!' });
      setTimeout(() => setNotification({ show: false }), 3000);
    } catch (error) {
      setNotification({ show: true, type: 'error', message: 'Failed to save data.' });
    }
    setLoading(false);
  };

  const generatePDF = () => {
    setNotification({ show: true, type: 'loading', message: 'Generating PDF...' });

    try {
      const doc = new jsPDF('l', 'mm', 'a4'); 
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text("UN POURED MOULD DETAILS", 148.5, 15, { align: 'center' });

      doc.setFontSize(11);
      doc.text(` ${headerData.disaMachine}`, 8, 25);
      const formattedDate = new Date(headerData.date).toLocaleDateString('en-GB');
      doc.text(`DATE: ${formattedDate}`, 289 - doc.getTextWidth(`DATE: ${formattedDate}`) - 8, 25);

      const headRow1 = [
        { content: 'SHIFT', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'MOULDING', colSpan: 6, styles: { halign: 'center' } },
        { content: 'SAND PLANT', colSpan: 2, styles: { halign: 'center' } },
        { content: 'PREESPOUR', colSpan: 4, styles: { halign: 'center' } },
        { content: 'QUALITY CONTROL', colSpan: 5, styles: { halign: 'center' } },
        { content: 'MAINTENANCE', colSpan: 1, styles: { halign: 'center' } },
        { content: 'FURNACE', colSpan: 1, styles: { halign: 'center' } },
        { content: 'TOOLING', colSpan: 1, styles: { halign: 'center' } },
        { content: 'OTHERS', colSpan: 4, styles: { halign: 'center' } },
        { content: 'TOTAL', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [220, 220, 220] } }
      ];

      const headRow2 = columns.map(col => ({
        content: col.label,
        styles: { halign: 'center', valign: 'middle', fontSize: 5.5 } 
      }));

      const bodyRows = [1, 2, 3].map(shift => {
        const row = [shift.toString()];
        columns.forEach(col => {
          const val = shiftsData[shift][col.key];
          row.push(val === '' || val === null || val === undefined ? '-' : val.toString());
        });
        
        const rowTotal = getRowTotal(shift);
        row.push(rowTotal === 0 ? '-' : rowTotal.toString());
        return row;
      });

      const totalRow = ['TOTAL'];
      columns.forEach(col => {
        const colTotal = getColTotal(col.key);
        totalRow.push(colTotal === 0 ? '-' : colTotal.toString());
      });
      
      const grandTotal = getGrandTotal();
      totalRow.push(grandTotal === 0 ? '-' : grandTotal.toString());
      bodyRows.push(totalRow);

      autoTable(doc, {
        startY: 32,
        margin: { left: 5, right: 5 }, 
        head: [headRow1, headRow2],
        body: bodyRows,
        theme: 'grid',
        styles: { 
            fontSize: 8, 
            cellPadding: { top: 3.5, right: 1, bottom: 3.5, left: 1 }, 
            lineColor: [0, 0, 0], 
            lineWidth: 0.15, 
            textColor: [0, 0, 0],
            halign: 'center',
            valign: 'middle'
        },
        headStyles: { 
            fillColor: [240, 240, 240], 
            textColor: [0, 0, 0], 
            fontStyle: 'bold',
            minCellHeight: 12 
        },
        bodyStyles: {
            minCellHeight: 10 
        },
        didParseCell: function(data) {
           if (data.section === 'body' && data.row.index === bodyRows.length - 1) {
               data.cell.styles.fontStyle = 'bold';
               data.cell.styles.fillColor = [240, 240, 240];
           }
        }
      });

      // --- APPEND SIGNATURES BELOW THE TABLE ---
      const finalY = doc.lastAutoTable.finalY + 15; // The Y coordinate to start drawing the signature
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');

      const shiftLabels = { 1: "1st shift", 2: "2nd shift", 3: "3rd shift" };

      [1, 2, 3].forEach((shift) => {
        const xPos = (pageWidth * shift) / 4; 

        let sig = '';
        if (sigRefs[shift].current && !sigRefs[shift].current.isEmpty()) {
          sig = sigRefs[shift].current.getCanvas().toDataURL('image/png');
        } else if (shiftsData[shift].operatorSignature) {
          sig = shiftsData[shift].operatorSignature;
        }

        // 🔥 1. DRAW THE SIGNATURE IMAGE FIRST
        if (sig && sig.startsWith('data:image')) {
          try {
            // Drawn directly at finalY. Height is 20, so it occupies space from finalY to finalY + 20
            doc.addImage(sig, 'PNG', xPos - 20, finalY, 40, 20);
          } catch (e) {
            console.error("PDF signature render error", e);
            doc.setFont('helvetica', 'normal');
            doc.text("Error loading signature", xPos, finalY + 12, { align: 'center' });
            doc.setFont('helvetica', 'bold');
          }
        } else {
           doc.setFont('helvetica', 'normal');
           // Draw a dash if no signature exists
           doc.text("-", xPos, finalY + 12, { align: 'center' });
           doc.setFont('helvetica', 'bold');
        }
        
        // 🔥 2. DRAW THE SHIFT TEXT BELOW THE SIGNATURE (finalY + 28)
        doc.text(shiftLabels[shift], xPos, finalY + 28, { align: 'center' });
      });

      doc.save(`UnPoured_Mould_Details_${headerData.date}.pdf`);
      setNotification({ show: false, type: '', message: '' });

    } catch (error) {
      console.error("PDF Gen Error:", error);
      setNotification({ show: true, type: 'error', message: `PDF Generation Failed: ${error.message}` });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 flex justify-center pb-24">
      
      <NotificationModal data={notification} onClose={() => setNotification({ ...notification, show: false })} />

      <div className="w-full max-w-[98%] bg-white shadow-xl rounded-2xl flex flex-col overflow-hidden">
        
        <div className="bg-gray-900 py-6 px-8 flex justify-between items-center rounded-t-2xl">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="text-orange-500 text-2xl">📉</span> Un Poured Mould Details
          </h2>
          <div className="flex items-center gap-3">
             <select 
               value={headerData.disaMachine}
               onChange={(e) => setHeaderData({...headerData, disaMachine: e.target.value})}
               className="bg-gray-800 text-white font-bold border-2 border-orange-500 rounded-md p-2 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
             >
                <option value="DISA - I">DISA - I</option>
                <option value="DISA - II">DISA - II</option>
                <option value="DISA - III">DISA - III</option>
                <option value="DISA - IV">DISA - IV</option>
             </select>

             <span className="text-orange-400 text-lg font-black uppercase tracking-wider">Date:</span>
             <div className="bg-gray-100 text-gray-600 font-bold border-2 border-gray-400 rounded-md p-2 text-lg cursor-not-allowed shadow-inner select-none">
                 {new Date(headerData.date).toLocaleDateString('en-GB')}
             </div>
          </div>
        </div>

        <div className="p-6 overflow-x-auto min-h-[400px] custom-scrollbar border-b">
          <table className="w-full text-center border-collapse table-fixed min-w-[2300px]">
            <thead className="bg-gray-100">
              <tr className="text-xs text-gray-600 uppercase border-y-2 border-orange-200">
                <th className="border border-gray-300 p-3 w-20 bg-gray-100 z-10" rowSpan="2">SHIFT</th>
                <th className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan="6">MOULDING</th>
                <th className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan="2">SAND PLANT</th>
                <th className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan="4">PREESPOUR</th>
                <th className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan="5">QUALITY CONTROL</th>
                <th className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan="1">MAINTENANCE</th>
                <th className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan="1">FURNACE</th>
                <th className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan="1">TOOLING</th>
                <th className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan="4">OTHERS</th>
                <th className="border border-gray-300 p-3 w-24 bg-gray-200 z-10 border-l-2 border-l-orange-300" rowSpan="2">TOTAL</th>
              </tr>
              
              <tr className="text-[10px] text-gray-500 uppercase tracking-wide bg-gray-50">
                {columns.map((col, idx) => (
                  <th key={idx} className={`border border-gray-300 p-2 align-bottom whitespace-pre-wrap leading-snug w-20 ${col.isLastInGroup ? 'border-r-2 border-r-gray-400' : ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {[1, 2, 3].map(shift => (
                <tr key={shift} className="hover:bg-orange-50/30 transition-colors group h-14">
                  <td className="border border-gray-300 font-black text-gray-700 bg-gray-50 z-10 group-hover:bg-orange-50/80">
                    {shift}
                  </td>
                  
                  {columns.map(col => (
                    <td key={col.key} className={`border border-gray-300 p-0 relative ${col.isLastInGroup ? 'border-r-2 border-r-gray-400' : ''}`}>
                      <input 
                        type="number" 
                        min="0"
                        value={shiftsData[shift][col.key]} 
                        onChange={(e) => handleInputChange(shift, col.key, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-800 bg-transparent outline-none focus:bg-orange-100 focus:ring-inset focus:ring-2 focus:ring-orange-500 [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                      />
                    </td>
                  ))}
                  
                  <td className="border border-gray-300 font-bold text-gray-800 bg-gray-100 z-10 border-l-2 border-l-orange-300">
                     {getRowTotal(shift) || ''}
                  </td>
                </tr>
              ))}

              <tr className="bg-gray-200 h-14 font-black">
                <td className="border border-gray-400 text-gray-800 z-10 bg-gray-200">TOTAL</td>
                
                {columns.map(col => (
                   <td key={col.key} className={`border border-gray-400 text-gray-800 ${col.isLastInGroup ? 'border-r-2 border-r-gray-500' : ''}`}>
                      {getColTotal(col.key) || ''}
                   </td>
                ))}
                
                <td className="border border-gray-400 text-xl text-orange-800 bg-orange-200 z-10 border-l-2 border-l-orange-400 shadow-inner">
                   {getGrandTotal() || '0'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* --- SIGNATURE PADS SECTION --- */}
        <div className="p-8 bg-white grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(shift => (
                <div key={`sig-${shift}`} className="flex flex-col items-center">
                    <h3 className="font-bold text-gray-800 mb-3">{shift === 1 ? '1st' : shift === 2 ? '2nd' : '3rd'} Shift Operator</h3>
                    <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg w-full max-w-[280px]">
                        <SignatureCanvas 
                          ref={sigRefs[shift]} 
                          penColor="blue"
                          canvasProps={{ className: 'w-full h-24 cursor-crosshair rounded-lg' }} 
                        />
                    </div>
                    <button 
                      onClick={() => clearSignature(shift)} 
                      className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold uppercase tracking-wider"
                    >
                      Clear Signature
                    </button>
                </div>
            ))}
        </div>

        {/* --- Footer Action Bar --- */}
        <div id="checklist-footer" className="bg-slate-100 p-8 border-t border-gray-200 bottom-0 z-20 flex justify-end gap-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
           <button 
             onClick={generatePDF} 
             className="bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-200 font-bold py-3 px-6 rounded-lg shadow-md uppercase flex items-center gap-2 mt-auto transition-colors"
           >
             <FileDown size={20} /> PDF
           </button>

           <button 
             onClick={handleSave}
             disabled={loading}
             className="bg-gray-900 hover:bg-orange-600 text-white font-bold py-3 px-12 rounded-lg shadow-lg uppercase mt-auto transition-colors flex items-center gap-3"
           >
             {loading ? <Loader className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
             {loading ? 'Saving...' : 'Save All Shifts'}
           </button>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
};

export default UnPouredMouldDetails;