import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, AlertTriangle, Save, Loader, FileDown, UserCheck, ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Shared Notification Modal ---
const NotificationModal = ({ data, onClose }) => {
  if (!data.show) return null;
  const isError = data.type === 'error';
  const isLoading = data.type === 'loading';
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`border-2 w-full max-w-sm p-6 rounded-xl shadow-xl bg-white ${isError ? 'border-red-400' : isLoading ? 'border-blue-400' : 'border-green-400'}`}>
        <div className="flex items-center gap-4">
           {isLoading ? <Loader className="animate-spin text-blue-600 w-8 h-8" /> : isError ? <AlertTriangle className="text-red-600 w-8 h-8" /> : <CheckCircle className="text-green-600 w-8 h-8" />}
           <div>
             <h3 className="font-bold text-lg text-gray-900">{isLoading ? 'Processing...' : isError ? 'Action Required' : 'Success'}</h3>
             <p className="text-sm font-medium text-gray-600 mt-1">{data.message}</p>
           </div>
        </div>
        {!isLoading && <button onClick={onClose} className="mt-5 px-6 py-2 bg-gray-900 hover:bg-orange-500 transition-colors text-white rounded-lg text-sm font-bold float-right shadow-sm">Close</button>}
      </div>
    </div>
  );
};

// --- Custom Searchable Select (Dark Header Friendly) ---
const HeaderSearchableSelect = ({ options, displayKey, onSelect, value, placeholder }) => {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => { setSearch(value || ""); }, [value]);

  const filtered = options.filter((item) =>
    item[displayKey]?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full h-full flex items-center">
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        // Timeout prevents the dropdown from closing before the click registers
        onBlur={() => setTimeout(() => setOpen(false), 200)} 
        className="px-3 py-2 bg-transparent text-white font-semibold text-sm outline-none w-full placeholder:text-gray-400 focus:placeholder:text-gray-600"
        placeholder={placeholder}
      />
      {open && (
        <ul className="absolute top-[110%] left-0 z-50 bg-white border border-gray-300 w-full max-h-40 overflow-y-auto rounded shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((item, index) => (
              <li
                key={index}
                onMouseDown={(e) => { 
                  e.preventDefault(); 
                  setSearch(item[displayKey]); 
                  setOpen(false); 
                  onSelect(item); 
                }}
                className="p-2 hover:bg-orange-50 cursor-pointer text-sm text-gray-800 font-semibold"
              >
                {item[displayKey]}
              </li>
            ))
          ) : (
            <li className="p-2 text-gray-500 text-sm">No results found</li>
          )}
        </ul>
      )}
    </div>
  );
};

// --- Main Page Component ---
const ErrorProofVerification2 = () => {
  const [headerData, setHeaderData] = useState({ 
    disaMachine: 'DISA - I',
    reviewedBy: '',
    approvedBy: ''
  });
  const [verifications, setVerifications] = useState([]);
  const [reactionPlans, setReactionPlans] = useState([]);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  
  // Dropdown states
  const [hofList, setHofList] = useState([]);
  const [operatorList, setOperatorList] = useState([]);

  // Single Date Setup
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

  // Master definition to force consistency across all machines
  const standardDefinitions = [
    {
      Line: 'All the 4 DISA Lines',
      ErrorProofName: 'Ceramic Filter Missing Sensor provision system with alarm indication and line stoppage',
      NatureOfErrorProof: 'Light indicator with alarm and line stoppage system provided to find ceramic filter missing possibility in the moulds',
      Frequency: 'S'
    },
    {
      Line: 'DISA 1, 2, 3 & 4 Lines',
      ErrorProofName: 'Line stoppage interlink provision for lower than the specification limit, the DMM machine will be stopped',
      NatureOfErrorProof: 'If compressibility will higher or lower than the specification limit, the DMM machine will be stopped',
      Frequency: 'S'
    }
  ];

  useEffect(() => { fetchData(); }, [headerData.disaMachine]);

  const fetchData = async () => {
    setNotification({ show: true, type: 'loading', message: 'Loading data...' });
    try {
      const res = await axios.get('http://localhost:5000/api/error-proof/details', { params: { machine: headerData.disaMachine } });
      
      // Load dropdown users
      setHofList(res.data.hofs || []);
      setOperatorList(res.data.operators || []);

      if (res.data.verifications && res.data.verifications.length > 0) {
        const normalizedVerifications = res.data.verifications.map((v, index) => ({
           ...v,
           ...(standardDefinitions[index] || {}) 
        }));

        setVerifications(normalizedVerifications);
        setReactionPlans(res.data.reactionPlans || []);
        setHeaderData(prev => ({
          ...prev,
          reviewedBy: res.data.verifications[0].ReviewedByHOF || '',
          approvedBy: res.data.verifications[0].ApprovedBy || ''
        }));
      } else {
        // Build fallback template for empty machines using "temp-" IDs
        const newTemplate = standardDefinitions.map((def, idx) => ({
          Id: `temp-${idx+1}`,
          ...def,
          Date1_Shift1_Res: null, Date1_Shift2_Res: null, Date1_Shift3_Res: null
        }));
        setVerifications(newTemplate);
        setReactionPlans([]);
        setHeaderData(prev => ({ ...prev, reviewedBy: '', approvedBy: '' }));
      }
      setNotification({ show: false, type: '', message: '' });
    } catch (error) {
      setNotification({ show: true, type: 'error', message: "Failed to load data from server." });
    }
  };

  const handleInputChange = (id, field, value) => {
    setVerifications(prev => prev.map(row => row.Id === id ? { ...row, [field]: value } : row));
  };

  const handleResultChange = (row, shiftIdx, value) => {
    const fieldBase = `Date1_Shift${shiftIdx}`;
    handleInputChange(row.Id, `${fieldBase}_Res`, value);

    const shiftLabel = `${currentDate} - Shift ${shiftIdx}`;

    if (value === 'NOT OK') {
      // Append to Reaction Plans table if it doesn't already exist
      setReactionPlans(prev => {
        const exists = prev.find(p => p.VerificationId === row.Id && p.VerificationDateShift === shiftLabel);
        if (exists) return prev;
        
        return [...prev, {
          VerificationId: row.Id,
          ErrorProofNo: '',
          ErrorProofName: row.ErrorProofName,
          VerificationDateShift: shiftLabel,
          Problem: '', RootCause: '', CorrectiveAction: '', Status: '', ReviewedBy: '', ApprovedBy: '', Remarks: ''
        }];
      });
    } else if (value === 'OK') {
      // If changed back to OK, cleanly remove from Reaction Plans
      setReactionPlans(prev => prev.filter(p => !(p.VerificationId === row.Id && p.VerificationDateShift === shiftLabel)));
    }
  };

  const handleReactionPlanChange = (index, field, value) => {
    const updatedPlans = [...reactionPlans];
    updatedPlans[index][field] = value;
    setReactionPlans(updatedPlans);
  };

  const handleSaveAll = async () => {
    if (!headerData.reviewedBy.trim() || !headerData.approvedBy.trim()) {
        setNotification({ 
            show: true, 
            type: 'error', 
            message: 'Please fill in both "Reviewed By HOF" and "Moulding Incharge" fields before saving.' 
        });
        return;
    }

    setNotification({ show: true, type: 'loading', message: 'Saving data...' });
    try {
      const plansToSave = reactionPlans.map((p, i) => ({ ...p, SNo: i + 1 }));

      await axios.post('http://localhost:5000/api/error-proof/save', {
        machine: headerData.disaMachine,
        verifications,
        reactionPlans: plansToSave,
        headerDetails: { reviewedBy: headerData.reviewedBy, approvedBy: headerData.approvedBy }
      });
      setNotification({ show: true, type: 'success', message: 'Data saved successfully!' });
      
      setTimeout(() => fetchData(), 1500); 
    } catch (error) {
      setNotification({ show: true, type: 'error', message: 'Failed to save data.' });
    }
  };

  const generatePDF = () => {
    setNotification({ show: true, type: 'loading', message: 'Generating PDF...' });
    
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      
      // Document Header
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI AUTO COMPONENT LIMITED", 148.5, 12, { align: 'center' });
      doc.setFontSize(16);
      doc.text("ERROR PROOF VERIFICATION CHECK LIST - FDY", 148.5, 20, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`DISA MACHINE: ${headerData.disaMachine}`, 10, 30);
      
      // Main Table Header
      const mainHead = [
        [
          { content: 'Line', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }, 
          { content: 'Error Proof Name', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }, 
          { content: 'Nature of Error Proof', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }, 
          { content: 'Frequency', rowSpan: 3, styles: { halign: 'center', valign: 'middle', cellWidth: 15 } }, 
          { content: `Date: ${currentDate}`, colSpan: 3, styles: { halign: 'center', fillColor: [240, 240, 240] } }
        ],
        [
          { content: 'I Shift', styles: { halign: 'center' } }, 
          { content: 'II Shift', styles: { halign: 'center' } }, 
          { content: 'III Shift', styles: { halign: 'center' } }
        ],
        [
          { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }, 
          { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }, 
          { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }
        ]
      ];

      const mainBody = verifications.map(row => {
        const pdfRow = [row.Line, row.ErrorProofName, row.NatureOfErrorProof, row.Frequency];
        [1, 2, 3].forEach(s => {
          const res = row[`Date1_Shift${s}_Res`] || '-';
          pdfRow.push(res);
        });
        return pdfRow;
      });

      autoTable(doc, {
        startY: 34, margin: { left: 10, right: 10 },
        head: mainHead, body: mainBody,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineColor: [0,0,0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [230,230,230], textColor: [0,0,0], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 45 }, 2: { cellWidth: 70 } }
      });

      // Signatures
      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text("Verified By Moulding Incharge", 20, finalY);
      doc.rect(20, finalY + 2, 40, 10); 
      doc.setFont('helvetica', 'normal');
      doc.text(headerData.approvedBy || '', 22, finalY + 9); 

      doc.setFont('helvetica', 'bold');
      doc.text("Reviewed By HOF", 130, finalY);
      doc.rect(130, finalY + 2, 40, 10); 
      doc.setFont('helvetica', 'normal');
      doc.text(headerData.reviewedBy || '', 132, finalY + 9);

      // Notes Section
      const noteY = finalY + 20; 
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text("NOTE:", 10, noteY);
      doc.setFont('helvetica', 'normal');
      doc.text("a) If Error Proof verification gets failed, inform to Quality team and Previous batch to be Contained (Applicable to till last Error Proof verification time/date)", 15, noteY + 6);
      doc.text("b) If any deviation noticed during continuous monitoring, will be adjusted, Corrected and recorded.", 15, noteY + 12);
      doc.text("c) Inform to concern department and correct the failure, then check the first part.", 15, noteY + 18);
      doc.text("d) Error proofs are simulated voluntarily to verify the error proof function is called verification.", 15, noteY + 24);
      doc.text("*S - Shift, D - Daily, W - Week, M - Month", 10, noteY + 32);

      doc.setFontSize(8);
      doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);

      // Reaction Plan Page
      if (reactionPlans.length > 0) {
        doc.addPage();
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text("REACTION PLAN", 148.5, 15, { align: 'center' });

        const planHead = [['S.No', 'Error Proof No', 'Error Proof Name', 'Verification Date / Shift', 'Problem', 'Root Cause', 'Corrective Action', 'Status', 'Reviewed By', 'Approved By', 'Remarks']];
        const planBody = reactionPlans.map((p, i) => [i + 1, p.ErrorProofNo || '-', p.ErrorProofName, p.VerificationDateShift, p.Problem, p.RootCause, p.CorrectiveAction, p.Status, p.ReviewedBy, p.ApprovedBy, p.Remarks]);

        autoTable(doc, {
          startY: 25, margin: { left: 5, right: 5 },
          head: planHead, body: planBody,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2, lineColor: [0,0,0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [230,230,230], textColor: [0,0,0], fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 15 }, 2: { cellWidth: 35 }, 3: { cellWidth: 25 }, 4: { cellWidth: 30 } }
        });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
      }

      doc.save(`Error_Proof_Verification_${headerData.disaMachine}.pdf`);
      setNotification({ show: false, type: '', message: '' });
    } catch(err) {
      setNotification({ show: true, type: 'error', message: 'PDF generation failed.' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 flex justify-center pb-20 items-stretch">
      <NotificationModal data={notification} onClose={() => setNotification({ ...notification, show: false })} />
      
      <div className="w-full max-w-[95%] min-h-[85vh] bg-white shadow-lg border border-gray-300 rounded-xl flex flex-col overflow-hidden">
        
        {/* --- Header Bar --- */}
        <div className="bg-gray-900 py-5 px-6 flex justify-between items-center shrink-0 rounded-t-xl flex-wrap gap-4 border-b-2 border-orange-500">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <span className="text-orange-500 text-2xl">🛡️</span> Error Proof Verification
            </h2>
            <div className="flex items-center">
              <select 
                value={headerData.disaMachine} 
                onChange={(e) => setHeaderData({...headerData, disaMachine: e.target.value})} 
                className="bg-gray-800 text-white font-bold border border-orange-500 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer transition-all shadow-sm"
              >
                <option value="DISA - I">DISA - I</option>
                <option value="DISA - II">DISA - II</option>
                <option value="DISA - III">DISA - III</option>
                <option value="DISA - IV">DISA - IV</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Changed overflow-hidden to overflow-visible to allow dropdowns to show */}
             <div className="bg-gray-800 border border-gray-600 rounded-md flex overflow-visible focus-within:border-orange-500 transition-colors shadow-sm relative z-50">
                <span className="bg-gray-700 px-3 py-2 border-r border-gray-600 flex items-center gap-2 text-[10px] font-bold uppercase text-gray-300">
                  <UserCheck size={14}/> Reviewed By HOF
                </span>
                <div className="w-48">
                  <HeaderSearchableSelect 
                    options={hofList} 
                    displayKey="name" 
                    value={headerData.reviewedBy} 
                    onSelect={(item) => setHeaderData({...headerData, reviewedBy: item.name})} 
                    placeholder="Required*" 
                  />
                </div>
             </div>

             <div className="bg-gray-800 border border-gray-600 rounded-md flex overflow-visible focus-within:border-orange-500 transition-colors shadow-sm relative z-40">
                <span className="bg-gray-700 px-3 py-2 border-r border-gray-600 flex items-center gap-2 text-[10px] font-bold uppercase text-gray-300">
                  <ShieldCheck size={14}/> Moulding Incharge
                </span>
                <div className="w-48">
                  <HeaderSearchableSelect 
                    options={operatorList} 
                    displayKey="name" 
                    value={headerData.approvedBy} 
                    onSelect={(item) => setHeaderData({...headerData, approvedBy: item.name})} 
                    placeholder="Required*" 
                  />
                </div>
             </div>
          </div>
        </div>

        {/* --- Main Table Section --- */}
        <div className="p-4 overflow-x-auto flex-1 custom-scrollbar bg-gray-50 flex flex-col">
          <table className="w-full text-center border-collapse table-fixed min-w-[1000px] shadow-sm bg-white border border-gray-300">
            <thead className="bg-gray-200">
              <tr className="text-xs text-gray-800 uppercase border-b-2 border-gray-300">
                <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-200 w-24 font-bold">Line</th>
                <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-100 w-64 font-bold">Error Proof Name</th>
                <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-100 w-80 font-bold">Nature of Error Proof</th>
                <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-100 w-24 border-r-2 border-r-gray-300 font-bold">Frequency</th>
                
                <th colSpan="3" className="border border-gray-300 p-2 bg-orange-200 font-bold text-orange-900 tracking-wider text-sm border-b-2 border-b-gray-300">
                  Date: {currentDate}
                </th>
              </tr>
              <tr className="bg-gray-100 text-xs font-bold tracking-wide text-gray-800 border-b border-gray-300">
                {['I Shift', 'II Shift', 'III Shift'].map((shift, j) => (
                  <th key={j} className="border border-gray-300 p-2">
                    {shift}
                  </th>
                ))}
              </tr>
              <tr className="text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase tracking-wide">
                {[1, 2, 3].map((_, j) => (
                   <th key={j} className="border border-gray-300 p-1.5 bg-gray-200">Observation Result</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {verifications.map((row) => (
                <tr key={row.Id} className="hover:bg-orange-50/50 transition-colors group border-b border-gray-300">
                  <td className="border border-gray-300 font-bold text-gray-800 bg-gray-50 p-4">{row.Line}</td>
                  <td className="border border-gray-300 p-4 text-left text-xs whitespace-pre-wrap font-semibold text-gray-800">{row.ErrorProofName}</td>
                  <td className="border border-gray-300 p-4 text-left text-xs whitespace-pre-wrap font-medium text-gray-700">{row.NatureOfErrorProof}</td>
                  <td className="border border-gray-300 p-4 font-bold text-gray-800 border-r-2 border-r-gray-300 bg-gray-50 text-xs">{row.Frequency}</td>
                  
                  {[1, 2, 3].map(s => {
                    const resKey = `Date1_Shift${s}_Res`;
                    const result = row[resKey];
                    return (
                      <td key={s} className={`border border-gray-300 p-2 align-middle transition-colors ${result === 'NOT OK' ? 'bg-red-50' : result === 'OK' ? 'bg-green-50' : 'bg-white'}`}>
                        <div className="flex flex-row items-center justify-center gap-4 px-2 w-full h-full min-h-[60px] whitespace-nowrap">
                           
                           <label className="flex items-center gap-1.5 cursor-pointer group/radio p-1.5 hover:bg-white/60 rounded transition-colors">
                             <input 
                               type="radio" 
                               name={`res-${row.Id}-1-${s}`} 
                               checked={result === 'OK'} 
                               onChange={() => handleResultChange(row, s, 'OK')} 
                               className="accent-green-600 w-4 h-4 cursor-pointer m-0" 
                             />
                             <span className="text-[10px] font-bold text-gray-700 group-hover/radio:text-green-800 leading-none mt-0.5">OK</span>
                           </label>
                           
                           <label className="flex items-center gap-1.5 cursor-pointer group/radio p-1.5 hover:bg-white/60 rounded transition-colors">
                             <input 
                               type="radio" 
                               name={`res-${row.Id}-1-${s}`} 
                               checked={result === 'NOT OK'} 
                               onChange={() => handleResultChange(row, s, 'NOT OK')} 
                               className="accent-red-600 w-4 h-4 cursor-pointer m-0" 
                             />
                             <span className="text-[10px] font-bold text-gray-700 group-hover/radio:text-red-800 leading-none mt-0.5">NOT OK</span>
                           </label>

                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {reactionPlans.length > 0 && (
             <div className="mt-8 mb-4">
                <div className="flex items-center gap-2 mb-3 px-2 border-b-2 border-red-500 pb-2">
                   <AlertTriangle className="text-red-600 w-6 h-6" />
                   <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Reaction Plans - Action Required</h3>
                </div>
                
                <table className="w-full text-center border-collapse table-fixed min-w-[1600px] shadow-md bg-white border-2 border-gray-400">
                  <thead className="bg-red-50">
                    <tr className="text-sm text-gray-900 uppercase border-b-2 border-gray-400 font-black">
                      <th className="border border-gray-400 p-3 w-12">S.No</th>
                      <th className="border border-gray-400 p-3 w-32">EP No</th>
                      <th className="border border-gray-400 p-3 w-64">Error Proof Name</th>
                      <th className="border border-gray-400 p-3 w-48">Date / Shift</th>
                      <th className="border border-gray-400 p-3 w-48">Problem</th>
                      <th className="border border-gray-400 p-3 w-48">Root Cause</th>
                      <th className="border border-gray-400 p-3 w-48">Corrective Action</th>
                      <th className="border border-gray-400 p-3 w-32">Status</th>
                      <th className="border border-gray-400 p-3 w-32">Reviewed By</th>
                      <th className="border border-gray-400 p-3 w-32">Approved By</th>
                      <th className="border border-gray-400 p-3 w-40">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reactionPlans.map((plan, idx) => (
                      <tr key={`${plan.VerificationId}-${plan.VerificationDateShift}`} className="hover:bg-red-50/30 border-b border-gray-400 group h-20">
                        <td className="border border-gray-400 p-3 font-black text-gray-900 bg-gray-100 text-sm">{idx + 1}</td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50">
                           <input type="text" value={plan.ErrorProofNo} onChange={(e) => handleReactionPlanChange(idx, 'ErrorProofNo', e.target.value)} className="absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors placeholder:text-gray-400 placeholder:font-medium" placeholder="EP-XX" />
                        </td>
                        <td className="border border-gray-400 p-3 text-sm font-bold text-gray-900 text-left leading-snug">{plan.ErrorProofName}</td>
                        <td className="border border-gray-400 p-3 text-sm font-black whitespace-nowrap bg-red-100 text-red-800">{plan.VerificationDateShift}</td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50">
                           <textarea value={plan.Problem} onChange={(e) => handleReactionPlanChange(idx, 'Problem', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Describe Problem..." />
                        </td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50">
                           <textarea value={plan.RootCause} onChange={(e) => handleReactionPlanChange(idx, 'RootCause', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Root Cause..." />
                        </td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50">
                           <textarea value={plan.CorrectiveAction} onChange={(e) => handleReactionPlanChange(idx, 'CorrectiveAction', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Action Taken..." />
                        </td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50">
                           <input type="text" value={plan.Status} onChange={(e) => handleReactionPlanChange(idx, 'Status', e.target.value)} className="absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors placeholder:text-gray-400 placeholder:font-medium" placeholder="Pending" />
                        </td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50">
                           <input type="text" value={plan.ReviewedBy} onChange={(e) => handleReactionPlanChange(idx, 'ReviewedBy', e.target.value)} className="absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors placeholder:text-gray-400 placeholder:font-medium" placeholder="Reviewer" />
                        </td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50">
                           <input type="text" value={plan.ApprovedBy} onChange={(e) => handleReactionPlanChange(idx, 'ApprovedBy', e.target.value)} className="absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors placeholder:text-gray-400 placeholder:font-medium" placeholder="Approver" />
                        </td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50">
                           <textarea value={plan.Remarks} onChange={(e) => handleReactionPlanChange(idx, 'Remarks', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Remarks..." />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          )}
        </div>

        {/* --- Notes Section --- */}
        <div className="bg-gray-100 p-6 border-t border-gray-300 text-gray-800 text-sm font-medium leading-relaxed shrink-0">
            <h4 className="font-bold text-gray-900 mb-2 uppercase">NOTE:</h4>
            <ul className="list-none space-y-1 pl-2 text-[13px]">
                <li>a) If Error Proof verification gets failed, inform to Quality team and Previous batch to be Contained (Applicable to till last Error Proof verification time/date)</li>
                <li>b) If any deviation noticed during continuous monitoring, will be adjusted, Corrected and recorded.</li>
                <li>c) Inform to concern department and correct the failure, then check the first part.</li>
                <li>d) Error proofs are simulated voluntarily to verify the error proof function is called verification.</li>
            </ul>
            <p className="mt-3 font-semibold text-xs text-gray-600">*S - Shift, D - Daily, W - Week, M - Month</p>
        </div>

        {/* --- Footer Action Bar --- */}
        <div className="bg-gray-200 p-6 border-t border-gray-300 sticky bottom-0 z-20 flex justify-end gap-4 shrink-0 rounded-b-xl shadow-inner">
           <button 
             onClick={generatePDF} 
             className="bg-white border border-gray-400 text-gray-800 hover:bg-gray-200 font-bold py-2.5 px-6 rounded-lg shadow-sm uppercase flex items-center gap-2 transition-colors text-sm"
           >
             <FileDown size={18} /> Download PDF
           </button>

           <button 
             onClick={handleSaveAll} 
             className="bg-gray-900 hover:bg-orange-600 text-white font-bold py-2.5 px-10 rounded-lg shadow-md uppercase transition-all flex items-center gap-2 text-sm"
           >
             <Save className="w-5 h-5" /> Save All Data
           </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #cbd5e1; border-radius: 6px; border: 1px solid #94a3b8; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #64748b; border-radius: 6px; border: 1px solid #cbd5e1; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
};

export default ErrorProofVerification2;