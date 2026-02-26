import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Header from "../components/Header";
import SignatureCanvas from "react-signature-canvas";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader, Maximize2, Minimize2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SupervisorBottomLevel = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isPdfMaximized, setIsPdfMaximized] = useState(false); 
  const sigCanvas = useRef({});
  
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentSupervisor = storedUser.username || "supervisor1";

  const API_BASE = 'http://localhost:5000/api/bottom-level-audit';

  useEffect(() => {
    fetchReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/supervisor/${currentSupervisor}`);
      setReports(res.data);
    } catch (err) {
      toast.error("Failed to load reports.");
    }
  };

  const handleOpenSignModal = async (report) => {
    setSelectedReport(report);
    setPdfUrl(null);
    setIsPdfLoading(true);
    setIsPdfMaximized(false); 

    try {
      const selectedDate = new Date(report.reportDate);
      const month = selectedDate.getMonth() + 1;
      const year = selectedDate.getFullYear();
      const disaMachine = report.disa;
      const dateStr = selectedDate.toISOString().split('T')[0];

      const [detailsRes, monthlyRes] = await Promise.all([
        axios.get(`${API_BASE}/details`, { params: { date: dateStr, disaMachine } }),
        axios.get(`${API_BASE}/monthly-report`, { params: { month, year, disaMachine } })
      ]);

      const checklist = detailsRes.data.checklist;
      const monthlyLogs = monthlyRes.data.monthlyLogs || [];
      const ncReports = monthlyRes.data.ncReports || [];

      const historyMap = {};
      const holidayDays = new Set();
      const vatDays = new Set();
      const supSigMap = {}; 
      const hofSig = monthlyLogs.find(l => l.HOFSignature)?.HOFSignature; 

      monthlyLogs.forEach(log => {
        const logDay = log.DayVal; 
        const key = String(log.MasterId); 
        
        if (Number(log.IsHoliday) === 1) holidayDays.add(logDay);
        if (Number(log.IsVatCleaning) === 1) vatDays.add(logDay);
        if (log.SupervisorSignature) supSigMap[logDay] = log.SupervisorSignature;

        if (!historyMap[key]) historyMap[key] = {};
        
        if (log.IsNA == 1) {
            historyMap[key][logDay] = 'NA';
        } else if (log.IsDone == 1) {
            historyMap[key][logDay] = 'Y';
        } else {
            historyMap[key][logDay] = 'N'; 
        }
      });

      const doc = new jsPDF('l', 'mm', 'a4'); 
      const monthName = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(year, month, 0).getDate();

      doc.setLineWidth(0.3);
      doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
      doc.rect(50, 10, 237, 20); doc.setFontSize(16);
      doc.text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", 168, 22, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(`${disaMachine}`, 12, 35); 
      doc.text(`MONTH : ${monthName}`, 235, 35);

      const days = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
      
      const tableBody = checklist.map((item, rowIndex) => {
        const row = [String(item.SlNo), item.CheckPointDesc];
        for (let i = 1; i <= daysInMonth; i++) {
            if (holidayDays.has(i)) {
                if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } });
            } else if (vatDays.has(i)) {
                if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } });
            } else {
                const key = String(item.MasterId);
                row.push(historyMap[key]?.[i] || ''); 
            }
        }
        return row;
      });

      const supRow = ["", "Supervisor Sign"];
      for (let i = 1; i <= daysInMonth; i++) { supRow.push(supSigMap[i] ? "SIG" : ""); }

      const hofRow = ["", "HOF SIGN"];
      for (let i = 1; i <= daysInMonth - 5; i++) { hofRow.push(""); }
      hofRow.push({ content: hofSig ? 'HOF_SIG' : '', colSpan: 5, styles: { halign: 'center', valign: 'middle' } });

      const footerRows = [supRow, hofRow];
      const dynamicColumnStyles = {};
      for (let i = 2; i < daysInMonth + 2; i++) { dynamicColumnStyles[i] = { cellWidth: 5, halign: 'center' }; }

      autoTable(doc, {
        startY: 38,
        head: [[
          { content: 'S.No', styles: { halign: 'center', valign: 'middle' } },
          { content: 'Check Points', styles: { halign: 'center', valign: 'middle' } },
          ...days.map(d => ({ content: d, styles: { halign: 'center' } }))
        ]],
        body: [...tableBody, ...footerRows],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 105 }, ...dynamicColumnStyles },
        
        didDrawCell: function(data) {
           if (data.row.index === tableBody.length && data.column.index > 1) { 
               const dayIndex = data.column.index - 1; 
               if (data.cell.text[0] === 'SIG') {
                   const sigData = supSigMap[dayIndex];
                   if (sigData && sigData.startsWith('data:image')) {
                       doc.setFillColor(255, 255, 255);
                       doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');
                       try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch(e){}
                   }
               }
           }
           if (data.row.index === tableBody.length + 1) { 
               if (data.cell.text[0] === 'HOF_SIG' && hofSig && hofSig.startsWith('data:image')) {
                   doc.setFillColor(255, 255, 255);
                   doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');
                   try { doc.addImage(hofSig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch(e){}
               }
           }
        },
        didParseCell: function(data) {
           if (data.row.index >= tableBody.length && data.column.index === 1) {
               data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'right';
           }
           if (data.column.index > 1 && data.row.index < tableBody.length) {
             const rawTextArray = data.cell.text || [];
             const text = rawTextArray[0] ? rawTextArray[0] : '';
             
             if (text === 'Y') { data.cell.styles.font = 'ZapfDingbats'; data.cell.text = '3'; data.cell.styles.textColor = [0, 100, 0]; } 
             else if (text === 'N') { data.cell.styles.textColor = [255, 0, 0]; data.cell.text = 'X'; data.cell.styles.fontStyle = 'bold'; } 
             else if (text === 'NA') { data.cell.styles.fontSize = 5; data.cell.styles.textColor = [100, 100, 100]; data.cell.styles.fontStyle = 'bold'; }
           }
        }
      });

      const finalY = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text("Legend:   3 - OK     X - NOT OK     CA - Corrected during Audit     NA - Not Applicable", 10, finalY);
      doc.setFont('helvetica', 'normal');
      doc.text("Remarks: If Nonconformity please write on NCR format (back-side)", 10, finalY + 6);
      doc.text("QF/08/MRO - 18, Rev No: 02 dt 01.01.2022", 10, 200);
      doc.text("Page 1 of 2", 270, 200);

      const pdfBlobUrl = doc.output('bloburl');
      setPdfUrl(pdfBlobUrl);

    } catch (error) {
      toast.error("Failed to generate PDF preview.");
    }

    setIsPdfLoading(false);
  };

  const submitSignature = async () => {
    if (sigCanvas.current.isEmpty()) {
      toast.warning("Please provide your signature.");
      return;
    }

    const signatureData = sigCanvas.current.getCanvas().toDataURL("image/png");

    try {
      await axios.post(`${API_BASE}/sign-supervisor`, {
        date: new Date(selectedReport.reportDate).toISOString().split('T')[0],
        disaMachine: selectedReport.disa,
        signature: signatureData,
      });
      
      toast.success("Daily Audit approved and signed!");
      setSelectedReport(null); 
      fetchReports(); 
    } catch (err) {
      toast.error("Failed to save signature.");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-GB");
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="min-h-screen bg-[#2d2d2d] p-10">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">Supervisor Audit Review</h1>
            <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded font-bold uppercase shadow-sm">
              Logged in: {currentSupervisor}
            </span>
          </div>

          {reports.length === 0 ? (
            <p className="text-gray-500 italic">No daily audits pending your signature.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="p-3 border border-gray-300">Date</th>
                  <th className="p-3 border border-gray-300">Machine</th>
                  <th className="p-3 border border-gray-300">Status</th>
                  <th className="p-3 border border-gray-300 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td>
                    <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                    <td className="p-3 border border-gray-300">
                      {report.supervisorSignature ? (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span>
                      ) : (
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>
                      )}
                    </td>
                    <td className="p-3 border border-gray-300 text-center">
                      {!report.supervisorSignature && (
                        <button onClick={() => handleOpenSignModal(report)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded font-bold text-sm">Review & Sign</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all">
          <div className={`bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isPdfMaximized ? 'w-[98vw] h-[96vh]' : 'w-full max-w-7xl h-[90vh]'}`}>
            
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">Daily Review & Approve</h3>
              <button onClick={() => { setSelectedReport(null); setPdfUrl(null); }} className="text-gray-300 hover:text-white font-bold text-2xl">&times;</button>
            </div>
            
            <div className="p-6 flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
              <div className="flex-1 bg-gray-100 rounded-lg border border-gray-300 overflow-hidden flex flex-col h-full relative">
                <div className="bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 flex justify-between">
                  <span>Document Preview</span>
                  <button onClick={() => setIsPdfMaximized(!isPdfMaximized)} className="hover:text-blue-600 flex items-center gap-1">
                    {isPdfMaximized ? <><Minimize2 size={16} /> Shrink</> : <><Maximize2 size={16} /> Expand</>}
                  </button>
                </div>
                {isPdfLoading ? <div className="flex-1 flex justify-center items-center"><Loader className="animate-spin" /></div> : <iframe src={`${pdfUrl}#toolbar=0`} className="w-full flex-1 border-none" />}
              </div>

              {!isPdfMaximized && (
                <div className="w-full md:w-80 shrink-0 flex flex-col h-full overflow-y-auto transition-all">
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-6 text-sm flex flex-col gap-2">
                    <p><span className="font-bold text-gray-700">Date:</span> {formatDate(selectedReport.reportDate)}</p>
                    <p><span className="font-bold text-gray-700">Machine:</span> {selectedReport.disa}</p>
                  </div>
                  <label className="block text-gray-800 font-bold mb-2 text-sm">Sign below to verify & approve:</label>
                  <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2">
                    <SignatureCanvas ref={sigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-48 cursor-crosshair' }} />
                  </div>
                  <button onClick={() => sigCanvas.current.clear()} className="text-sm text-gray-500 hover:text-gray-800 font-bold underline mb-auto self-end">Clear Pad</button>
                  <div className="flex flex-col gap-3 mt-6">
                    <button onClick={submitSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-bold">Approve & Sign</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SupervisorBottomLevel;