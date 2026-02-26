import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CheckCircle, AlertTriangle, Save, Loader, FileDown, UserCheck, ShieldCheck } from 'lucide-react';
import SignatureCanvas from "react-signature-canvas";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Header from "../components/Header";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
        type="text" value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)} 
        className="px-3 py-2 bg-transparent text-white font-semibold text-sm outline-none w-full placeholder:text-gray-400 focus:placeholder:text-gray-600"
        placeholder={placeholder}
      />
      {open && (
        <ul className="absolute top-[110%] left-0 z-50 bg-white border border-gray-300 w-full max-h-40 overflow-y-auto rounded shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((item, index) => (
              <li key={index} onMouseDown={(e) => { e.preventDefault(); setSearch(item[displayKey]); setOpen(false); onSelect(item); }} className="p-2 hover:bg-orange-50 cursor-pointer text-sm text-gray-800 font-semibold">{item[displayKey]}</li>
            ))
          ) : (<li className="p-2 text-gray-500 text-sm">No results found</li>)}
        </ul>
      )}
    </div>
  );
};

const ErrorProofVerification2 = () => {
  const [headerData, setHeaderData] = useState({ disaMachine: 'DISA - I', reviewedBy: '', approvedBy: '', assignedHOF: '', operatorSignature: '', hofSignature: '' });
  const [verifications, setVerifications] = useState([]);
  const [reactionPlans, setReactionPlans] = useState([]);
  const opSigCanvas = useRef({});
  
  const [hofList, setHofList] = useState([]);
  const [operatorList, setOperatorList] = useState([]);
  const [supervisorList, setSupervisorList] = useState([]);

  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

  const standardDefinitions = [
    { Line: 'All the 4 DISA Lines', ErrorProofName: 'Ceramic Filter Missing Sensor provision system with alarm indication and line stoppage', NatureOfErrorProof: 'Light indicator with alarm and line stoppage system provided to find ceramic filter missing possibility in the moulds', Frequency: 'S' },
    { Line: 'DISA 1, 2, 3 & 4 Lines', ErrorProofName: 'Line stoppage interlink provision for lower than the specification limit, the DMM machine will be stopped', NatureOfErrorProof: 'If compressibility will higher or lower than the specification limit, the DMM machine will be stopped', Frequency: 'S' }
  ];

  useEffect(() => { fetchData(); }, [headerData.disaMachine]);

  const fetchData = async () => {
    try {
      // 🔥 FIXED: Pointing to /api/error-proof2
      const res = await axios.get('http://localhost:5000/api/error-proof2/details', { params: { machine: headerData.disaMachine } });
      
      setHofList(res.data.hofs || []);
      setOperatorList(res.data.operators || []);
      setSupervisorList(res.data.supervisors || []); 

      if (res.data.verifications && res.data.verifications.length > 0) {
        const normalizedVerifications = res.data.verifications.map((v, index) => ({ ...v, ...(standardDefinitions[index] || {}) }));
        setVerifications(normalizedVerifications);
        setReactionPlans(res.data.reactionPlans || []);
        setHeaderData(prev => ({
          ...prev,
          reviewedBy: res.data.verifications[0].ReviewedByHOF || '',
          approvedBy: res.data.verifications[0].ApprovedBy || '',
          assignedHOF: res.data.verifications[0].AssignedHOF || '',
          operatorSignature: res.data.verifications[0].OperatorSignature || '', 
          hofSignature: res.data.verifications[0].HOFSignature || '' 
        }));
      } else {
        const newTemplate = standardDefinitions.map((def, idx) => ({ Id: `temp-${idx+1}`, ...def, Date1_Shift1_Res: null, Date1_Shift2_Res: null, Date1_Shift3_Res: null }));
        setVerifications(newTemplate); setReactionPlans([]);
        setHeaderData(prev => ({ ...prev, reviewedBy: '', approvedBy: '', assignedHOF: '', operatorSignature: '', hofSignature: '' }));
      }
    } catch (error) { toast.error("Failed to load data from server."); }
  };

  const handleInputChange = (id, field, value) => {
    setVerifications(prev => prev.map(row => row.Id === id ? { ...row, [field]: value } : row));
  };

  const handleResultChange = (row, shiftIdx, value) => {
    handleInputChange(row.Id, `Date1_Shift${shiftIdx}_Res`, value);
    const shiftLabel = `${currentDate} - Shift ${shiftIdx}`;

    if (value === 'NOT OK') {
      setReactionPlans(prev => {
        if (prev.find(p => p.VerificationId === row.Id && p.VerificationDateShift === shiftLabel)) return prev;
        return [...prev, { VerificationId: row.Id, ErrorProofNo: '', ErrorProofName: row.ErrorProofName, VerificationDateShift: shiftLabel, Problem: '', RootCause: '', CorrectiveAction: '', Status: 'Pending', ReviewedBy: '', ApprovedBy: '', Remarks: '', SupervisorSignature: '' }];
      });
    } else if (value === 'OK') {
      setReactionPlans(prev => prev.filter(p => !(p.VerificationId === row.Id && p.VerificationDateShift === shiftLabel)));
    }
  };

  const handleReactionPlanChange = (index, field, value) => {
    const updatedPlans = [...reactionPlans];
    updatedPlans[index][field] = value;
    setReactionPlans(updatedPlans);
  };

  const handleSaveAll = async () => {
    if (!headerData.reviewedBy.trim() || !headerData.approvedBy.trim()) { toast.warning('Please fill in both "Reviewed By HOF" and "Moulding Incharge".'); return; }
    if (opSigCanvas.current.isEmpty() && !headerData.operatorSignature) { toast.warning('Please provide Operator Signature.'); return; }
    if (!headerData.assignedHOF) { toast.warning("Please assign a HOF for verification."); return; }

    const signatureData = !opSigCanvas.current.isEmpty() ? opSigCanvas.current.getCanvas().toDataURL("image/png") : headerData.operatorSignature;

    try {
      const plansToSave = reactionPlans.map((p, i) => ({ ...p, SNo: i + 1 }));
      // 🔥 FIXED: Pointing to /api/error-proof2
      await axios.post('http://localhost:5000/api/error-proof2/save', {
        machine: headerData.disaMachine, verifications, reactionPlans: plansToSave, operatorSignature: signatureData,
        headerDetails: { reviewedBy: headerData.reviewedBy, approvedBy: headerData.approvedBy, assignedHOF: headerData.assignedHOF }
      });
      toast.success('Data saved and assigned successfully!');
      setTimeout(() => fetchData(), 1500); 
    } catch (error) { toast.error('Failed to save data.'); }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text("SAKTHI AUTO COMPONENT LIMITED", 148.5, 12, { align: 'center' });
      doc.setFontSize(16); doc.text("ERROR PROOF VERIFICATION CHECK LIST - FDY", 148.5, 20, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`DISA MACHINE: ${headerData.disaMachine}`, 10, 30);
      
      const mainHead = [
        [
          { content: 'Line', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }, 
          { content: 'Error Proof Name', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }, 
          { content: 'Nature of Error Proof', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }, 
          { content: 'Frequency', rowSpan: 3, styles: { halign: 'center', valign: 'middle', cellWidth: 15 } }, 
          { content: `Date: ${currentDate}`, colSpan: 3, styles: { halign: 'center', fillColor: [240, 240, 240] } }
        ],
        [ { content: 'I Shift', styles: { halign: 'center' } }, { content: 'II Shift', styles: { halign: 'center' } }, { content: 'III Shift', styles: { halign: 'center' } } ],
        [ { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }, { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }, { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } } ]
      ];

      const mainBody = verifications.map(row => {
        const pdfRow = [row.Line, row.ErrorProofName, row.NatureOfErrorProof, row.Frequency];
        [1, 2, 3].forEach(s => { const res = row[`Date1_Shift${s}_Res`] || '-'; pdfRow.push(res); });
        return pdfRow;
      });

      autoTable(doc, {
        startY: 34, margin: { left: 10, right: 10 }, head: mainHead, body: mainBody, theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineColor: [0,0,0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [230,230,230], textColor: [0,0,0], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 45 }, 2: { cellWidth: 70 } }
      });

      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      
      doc.text("Verified By Moulding Incharge", 20, finalY);
      doc.rect(20, finalY + 2, 40, 15); 
      const opSigToDraw = !opSigCanvas.current.isEmpty() ? opSigCanvas.current.getCanvas().toDataURL("image/png") : headerData.operatorSignature;
      if (opSigToDraw && opSigToDraw.startsWith('data:image')) {
          doc.addImage(opSigToDraw, 'PNG', 21, finalY + 3, 38, 13);
      }

      doc.text("Reviewed By HOF", 130, finalY);
      doc.rect(130, finalY + 2, 40, 15); 
      if (headerData.hofSignature && headerData.hofSignature.startsWith('data:image')) {
          doc.addImage(headerData.hofSignature, 'PNG', 131, finalY + 3, 38, 13);
      }

      if (reactionPlans.length > 0) {
        doc.addPage();
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text("REACTION PLAN", 148.5, 15, { align: 'center' });

        const planHead = [['S.No', 'Error Proof No', 'Error Proof Name', 'Verification Date / Shift', 'Problem', 'Root Cause', 'Corrective Action', 'Status', 'Reviewed By (Op)', 'Approved By (Sup)', 'Remarks']];
        const planBody = reactionPlans.map((p, i) => [
            i + 1, p.ErrorProofNo || '-', p.ErrorProofName, p.VerificationDateShift, p.Problem, p.RootCause, p.CorrectiveAction, p.Status, 
            // 🔥 FIX: Render the Supervisor's Text Name in the PDF if they haven't signed yet!
            p.ReviewedBy || '-', p.SupervisorSignature || p.ApprovedBy || '-', p.Remarks || '-'
        ]);

        autoTable(doc, {
          startY: 25, margin: { left: 5, right: 5 }, head: planHead, body: planBody, theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2, lineColor: [0,0,0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [230,230,230], textColor: [0,0,0], fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 15 }, 2: { cellWidth: 35 }, 3: { cellWidth: 25 }, 4: { cellWidth: 30 } },
          
          didDrawCell: function (data) {
              if (data.section === 'body' && data.column.index === 9) {
                  const sig = reactionPlans[data.row.index].SupervisorSignature;
                  if (sig && sig.startsWith('data:image')) {
                      doc.addImage(sig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2);
                  }
              }
          },
          didParseCell: function (data) {
              if (data.section === 'body' && data.column.index === 9 && data.cell.text[0] && data.cell.text[0].startsWith('data:image')) {
                  data.cell.text = '';
              }
          }
        });
      }
      
      doc.save(`Error_Proof_Verification_${headerData.disaMachine}.pdf`);
      toast.success("PDF Downloaded successfully!");
    } catch(err) { toast.error("Failed to generate PDF."); }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="min-h-screen bg-gray-100 py-8 px-4 flex justify-center pb-20 items-stretch">
        <div className="w-full max-w-[95%] min-h-[85vh] bg-white shadow-lg border border-gray-300 rounded-xl flex flex-col overflow-hidden">
          
          <div className="bg-gray-900 py-5 px-6 flex justify-between items-center shrink-0 rounded-t-xl flex-wrap gap-4 border-b-2 border-orange-500">
            <div className="flex items-center gap-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-wide flex items-center gap-2"><span className="text-orange-500 text-2xl">🛡️</span> Error Proof Verification</h2>
              <select value={headerData.disaMachine} onChange={(e) => setHeaderData({...headerData, disaMachine: e.target.value})} className="bg-gray-800 text-white font-bold border border-orange-500 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer transition-all shadow-sm">
                <option value="DISA - I">DISA - I</option><option value="DISA - II">DISA - II</option><option value="DISA - III">DISA - III</option><option value="DISA - IV">DISA - IV</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
               <div className="bg-gray-800 border border-gray-600 rounded-md flex overflow-visible focus-within:border-orange-500 transition-colors shadow-sm relative z-50">
                  <span className="bg-gray-700 px-3 py-2 border-r border-gray-600 flex items-center gap-2 text-[10px] font-bold uppercase text-gray-300"><UserCheck size={14}/> Reviewed By HOF</span>
                  <div className="w-48"><HeaderSearchableSelect options={hofList} displayKey="name" value={headerData.reviewedBy} onSelect={(item) => setHeaderData({...headerData, reviewedBy: item.name})} placeholder="Required*" /></div>
               </div>
               <div className="bg-gray-800 border border-gray-600 rounded-md flex overflow-visible focus-within:border-orange-500 transition-colors shadow-sm relative z-40">
                  <span className="bg-gray-700 px-3 py-2 border-r border-gray-600 flex items-center gap-2 text-[10px] font-bold uppercase text-gray-300"><ShieldCheck size={14}/> Moulding Incharge</span>
                  <div className="w-48"><HeaderSearchableSelect options={operatorList} displayKey="name" value={headerData.approvedBy} onSelect={(item) => setHeaderData({...headerData, approvedBy: item.name})} placeholder="Required*" /></div>
               </div>
            </div>
          </div>

          <div className="p-4 overflow-x-auto flex-1 custom-scrollbar bg-gray-50 flex flex-col">
            <table className="w-full text-center border-collapse table-fixed min-w-[1000px] shadow-sm bg-white border border-gray-300">
              <thead className="bg-gray-200">
                <tr className="text-xs text-gray-800 uppercase border-b-2 border-gray-300">
                  <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-200 w-24 font-bold">Line</th>
                  <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-100 w-64 font-bold">Error Proof Name</th>
                  <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-100 w-80 font-bold">Nature of Error Proof</th>
                  <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-100 w-24 border-r-2 border-r-gray-300 font-bold">Frequency</th>
                  <th colSpan="3" className="border border-gray-300 p-2 bg-orange-200 font-bold text-orange-900 tracking-wider text-sm border-b-2 border-b-gray-300">Date: {currentDate}</th>
                </tr>
                <tr className="bg-gray-100 text-xs font-bold tracking-wide text-gray-800 border-b border-gray-300">
                  {['I Shift', 'II Shift', 'III Shift'].map((shift, j) => (<th key={j} className="border border-gray-300 p-2">{shift}</th>))}
                </tr>
                <tr className="text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase tracking-wide">
                  {[1, 2, 3].map((_, j) => (<th key={j} className="border border-gray-300 p-1.5 bg-gray-200">Observation Result</th>))}
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
                      const resKey = `Date1_Shift${s}_Res`; const result = row[resKey];
                      return (
                        <td key={s} className={`border border-gray-300 p-2 align-middle transition-colors ${result === 'NOT OK' ? 'bg-red-50' : result === 'OK' ? 'bg-green-50' : 'bg-white'}`}>
                          <div className="flex flex-row items-center justify-center gap-4 px-2 w-full h-full min-h-[60px] whitespace-nowrap">
                             <label className="flex items-center gap-1.5 cursor-pointer group/radio p-1.5 hover:bg-white/60 rounded transition-colors">
                               <input type="radio" name={`res-${row.Id}-1-${s}`} checked={result === 'OK'} onChange={() => handleResultChange(row, s, 'OK')} className="accent-green-600 w-4 h-4 cursor-pointer m-0" />
                               <span className="text-[10px] font-bold text-gray-700 group-hover/radio:text-green-800 leading-none mt-0.5">OK</span>
                             </label>
                             <label className="flex items-center gap-1.5 cursor-pointer group/radio p-1.5 hover:bg-white/60 rounded transition-colors">
                               <input type="radio" name={`res-${row.Id}-1-${s}`} checked={result === 'NOT OK'} onChange={() => handleResultChange(row, s, 'NOT OK')} className="accent-red-600 w-4 h-4 cursor-pointer m-0" />
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
                        <th className="border border-gray-400 p-3 w-12">S.No</th><th className="border border-gray-400 p-3 w-32">EP No</th><th className="border border-gray-400 p-3 w-64">Error Proof Name</th><th className="border border-gray-400 p-3 w-48">Date / Shift</th><th className="border border-gray-400 p-3 w-48">Problem</th><th className="border border-gray-400 p-3 w-48">Root Cause</th><th className="border border-gray-400 p-3 w-48">Corrective Action</th><th className="border border-gray-400 p-3 w-32">Status</th><th className="border border-gray-400 p-3 w-40">Reviewed By (Operator)</th><th className="border border-gray-400 p-3 w-40">Approved By (Supervisor)</th><th className="border border-gray-400 p-3 w-40">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reactionPlans.map((plan, idx) => (
                        <tr key={`${plan.VerificationId}-${plan.VerificationDateShift}`} className="hover:bg-red-50/30 border-b border-gray-400 group h-20">
                          <td className="border border-gray-400 p-3 font-black text-gray-900 bg-gray-100 text-sm">{idx + 1}</td>
                          <td className="border border-gray-400 p-0 relative bg-gray-50"><input type="text" value={plan.ErrorProofNo} onChange={(e) => handleReactionPlanChange(idx, 'ErrorProofNo', e.target.value)} className="absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors placeholder:text-gray-400 placeholder:font-medium" placeholder="EP-XX" /></td>
                          <td className="border border-gray-400 p-3 text-sm font-bold text-gray-900 text-left leading-snug">{plan.ErrorProofName}</td>
                          <td className="border border-gray-400 p-3 text-sm font-black whitespace-nowrap bg-red-100 text-red-800">{plan.VerificationDateShift}</td>
                          <td className="border border-gray-400 p-0 relative bg-gray-50"><textarea value={plan.Problem} onChange={(e) => handleReactionPlanChange(idx, 'Problem', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Describe Problem..." /></td>
                          <td className="border border-gray-400 p-0 relative bg-gray-50"><textarea value={plan.RootCause} onChange={(e) => handleReactionPlanChange(idx, 'RootCause', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Root Cause..." /></td>
                          <td className="border border-gray-400 p-0 relative bg-gray-50"><textarea value={plan.CorrectiveAction} onChange={(e) => handleReactionPlanChange(idx, 'CorrectiveAction', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Action Taken..." /></td>
                          <td className="border border-gray-400 p-0 relative bg-gray-50"><input type="text" value={plan.Status || 'Pending'} readOnly className="absolute inset-0 w-full h-full text-center text-sm font-bold text-red-700 bg-red-50 outline-none" /></td>
                          
                          <td className="border border-gray-400 p-2 align-top">
                            <select value={plan.ReviewedBy} onChange={(e) => handleReactionPlanChange(idx, 'ReviewedBy', e.target.value)} className="w-full border p-2 rounded focus:outline-blue-500 text-sm font-bold bg-white text-gray-800">
                               <option value="">Operator...</option>{operatorList.map((op, i) => <option key={i} value={op.name}>{op.name}</option>)}
                            </select>
                          </td>
                          <td className="border border-gray-400 p-2 align-top">
                            <select value={plan.ApprovedBy} onChange={(e) => handleReactionPlanChange(idx, 'ApprovedBy', e.target.value)} className="w-full border p-2 rounded focus:outline-blue-500 text-sm font-bold bg-white text-gray-800">
                               <option value="">Supervisor...</option>{supervisorList.map((sup, i) => <option key={i} value={sup.name}>{sup.name}</option>)}
                            </select>
                          </td>
                          
                          <td className="border border-gray-400 p-0 relative bg-gray-50"><textarea value={plan.Remarks} onChange={(e) => handleReactionPlanChange(idx, 'Remarks', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Remarks..." /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            )}
          </div>

          <div className="bg-gray-100 p-6 border-t border-gray-300 text-gray-800 text-sm font-medium leading-relaxed shrink-0">
             <h4 className="font-bold text-gray-900 mb-2 uppercase">NOTE:</h4>
             <ul className="list-none space-y-1 pl-2 text-[13px]">
                 <li>a) If Error Proof verification gets failed, inform to Quality team and Previous batch to be Contained...</li>
                 <li>b) If any deviation noticed during continuous monitoring, will be adjusted, Corrected and recorded.</li>
             </ul>
          </div>

          <div className="mt-2 pt-4 border-t-2 border-gray-200 flex flex-col md:flex-row justify-between items-end gap-8 bg-gray-50 p-6 rounded-b-xl shadow-inner">
             <div className="w-full md:w-1/3 flex flex-col">
                 <label className="text-xs font-black text-gray-700 uppercase mb-2">Operator Signature</label>
                 <div className="border-2 border-dashed border-gray-400 bg-white rounded-lg h-24 mb-2 overflow-hidden">
                    <SignatureCanvas ref={opSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-full cursor-crosshair' }} />
                 </div>
                 <button onClick={() => opSigCanvas.current.clear()} className="text-xs text-red-500 hover:text-red-700 font-bold self-end uppercase">Clear Pad</button>
             </div>
             
             <div className="w-full md:w-1/3 flex flex-col gap-4">
                 <div>
                    <label className="text-xs font-black text-gray-700 uppercase mb-2 block">Assign HOF for Final Verification</label>
                    <select value={headerData.assignedHOF} onChange={(e) => setHeaderData({...headerData, assignedHOF: e.target.value})} className="w-full p-3 border-2 border-gray-400 bg-white rounded-lg font-bold text-gray-800 outline-none focus:border-blue-500">
                       <option value="">Select HOF...</option>
                       {hofList.map((hof, i) => <option key={i} value={hof.name}>{hof.name}</option>)}
                    </select>
                 </div>
                 
                 <div className="flex gap-4">
                   <button onClick={generatePDF} className="w-1/2 bg-gray-800 hover:bg-gray-900 text-white py-3 rounded font-bold transition-colors shadow-md flex justify-center items-center gap-2">
                     <FileDown size={18} /> Preview PDF
                   </button>
                   <button onClick={handleSaveAll} className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-bold transition-colors shadow-lg flex justify-center items-center gap-2">
                     <Save size={18} /> Save & Assign
                   </button>
                 </div>
             </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ErrorProofVerification2;