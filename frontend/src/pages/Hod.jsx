import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Header from "../components/Header";
import SignatureCanvas from "react-signature-canvas";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader, Maximize2, Minimize2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Hod = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isPdfMaximized, setIsPdfMaximized] = useState(false); 
  const sigCanvas = useRef({});
  
  // 4M Change Reports
  const [fourMReports, setFourMReports] = useState([]);
  const [selectedFourMReport, setSelectedFourMReport] = useState(null);
  const [fourMPdfUrl, setFourMPdfUrl] = useState(null);
  const [isFourMPdfLoading, setIsFourMPdfLoading] = useState(false);
  const [isFourMPdfMaximized, setIsFourMPdfMaximized] = useState(false);
  const fourMSigCanvas = useRef({});

  // 🔥 NEW: Daily Production Performance
  const [dailyReports, setDailyReports] = useState([]);
  const [selectedDailyReport, setSelectedDailyReport] = useState(null);
  const [dailyPdfUrl, setDailyPdfUrl] = useState(null);
  const [isDailyPdfLoading, setIsDailyPdfLoading] = useState(false);
  const [isDailyPdfMaximized, setIsDailyPdfMaximized] = useState(false);
  const dailySigCanvas = useRef({});

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentHOD = storedUser.username || "hod_user";

  const DAILY_API_BASE = 'http://localhost:5000/api/daily-performance'; // 🔥 NEW API BASE

  useEffect(() => {
    fetchReports();
    fetchFourMReports();
    fetchDailyReports(); // 🔥 Fetch Daily Reports
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateString) => { return new Date(dateString).toLocaleDateString("en-GB"); };

  // ===============================================
  //  DISAMATIC LOGIC
  // ===============================================
  const fetchReports = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/disa-checklist/hod/${currentHOD}`);
      setReports(res.data);
    } catch (err) { toast.error("Failed to load Disa Machine reports."); }
  };

  const handleOpenSignModal = async (report) => {
    setSelectedReport(report); setPdfUrl(null); setIsPdfLoading(true); setIsPdfMaximized(false); 

    try {
      const selectedDate = new Date(report.reportDate);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const month = selectedDate.getMonth() + 1; const year = selectedDate.getFullYear();
      const disaMachine = report.disa;

      const [detailsRes, monthlyRes] = await Promise.all([
          axios.get('http://localhost:5000/api/disa-checklist/details', { params: { date: dateStr, disaMachine } }),
          axios.get('http://localhost:5000/api/disa-checklist/monthly-report', { params: { month, year, disaMachine } })
      ]);

      const checklist = detailsRes.data.checklist; const monthlyLogs = monthlyRes.data.monthlyLogs || []; const ncReports = monthlyRes.data.ncReports || [];
      const historyMap = {}; const holidayDays = new Set(); const vatDays = new Set();
      const opSigMap = {}; const hodSigMap = {};

      monthlyLogs.forEach(log => {
        const logDay = log.DayVal; const key = String(log.MasterId); 
        if (Number(log.IsHoliday) === 1) holidayDays.add(logDay);
        if (Number(log.IsVatCleaning) === 1) vatDays.add(logDay);
        if (log.OperatorSignature) opSigMap[logDay] = log.OperatorSignature;
        if (log.HODSignature) hodSigMap[logDay] = log.HODSignature;
        if (!historyMap[key]) historyMap[key] = {};
        if (log.ReadingValue) { historyMap[key][logDay] = log.ReadingValue; } else { if (Number(log.IsDone) === 1) historyMap[key][logDay] = 'Y'; else historyMap[key][logDay] = 'N'; }
      });

      const doc = new jsPDF('l', 'mm', 'a4'); 
      const monthName = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });

      doc.setLineWidth(0.3); doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
      doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.text("DISA MACHINE OPERATOR CHECK SHEET", 140, 22, { align: 'center' });
      doc.rect(230, 10, 57, 20); doc.setFontSize(11); doc.text(disaMachine, 258, 18, { align: 'center' }); 
      doc.line(230, 22, 287, 22); doc.setFontSize(10); doc.text(`Month: ${monthName}`, 235, 27);

      const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
      const tableBody = checklist.map((item, rowIndex) => {
        const row = [String(item.SlNo), item.CheckPointDesc, item.CheckMethod];
        for (let i = 1; i <= 31; i++) {
            if (holidayDays.has(i)) { if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } }); } 
            else if (vatDays.has(i)) { if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } }); } 
            else { row.push(historyMap[String(item.MasterId)]?.[i] || ''); }
        }
        return row;
      });

      const opSigRow = ["", "OPERATOR SIGN", ""]; const hodSigRow = ["", "HOD - MOU SIGN", ""];
      for (let i = 1; i <= 31; i++) { opSigRow.push(opSigMap[i] ? "SIG" : ""); hodSigRow.push(hodSigMap[i] ? "SIG" : ""); }
      const footerRows = [opSigRow, hodSigRow]; const dynamicColumnStyles = {}; for (let i = 3; i < 34; i++) { dynamicColumnStyles[i] = { cellWidth: 5, halign: 'center' }; }

      autoTable(doc, {
        startY: 35, head: [[ { content: 'Sl.No', styles: { halign: 'center', valign: 'middle' } }, { content: 'CHECK POINTS', styles: { halign: 'center', valign: 'middle' } }, { content: 'CHECK METHOD', styles: { halign: 'center', valign: 'middle' } }, ...days.map(d => ({ content: d, styles: { halign: 'center' } })) ]],
        body: [...tableBody, ...footerRows], theme: 'grid', styles: { fontSize: 6, cellPadding: 0.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 60 }, 2: { cellWidth: 25 }, ...dynamicColumnStyles },
        didDrawCell: function(data) {
           if (data.row.index >= tableBody.length && data.column.index > 2) {
               const dayIndex = data.column.index - 2; 
               if (data.cell.text[0] === 'SIG') {
                   const isOpRow = data.row.index === tableBody.length;
                   const sigData = isOpRow ? opSigMap[dayIndex] : hodSigMap[dayIndex];
                   if (sigData && sigData.startsWith('data:image')) {
                       doc.setFillColor(255, 255, 255); doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');
                       try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch(e){}
                   }
               }
           }
        },
        didParseCell: function(data) {
           if (data.row.index >= tableBody.length && data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; }
           if (data.column.index > 2 && data.row.index < tableBody.length) {
             const rawTextArray = data.cell.text || []; const rawTextString = rawTextArray.join('').replace(/\n/g, ''); const text = rawTextArray[0] ? rawTextArray[0] : '';
             if (text === 'Y') { data.cell.styles.font = 'ZapfDingbats'; data.cell.text = '3'; data.cell.styles.textColor = [0, 100, 0]; } 
             else if (text === 'N') { data.cell.styles.textColor = [255, 0, 0]; data.cell.text = 'X'; data.cell.styles.fontStyle = 'bold'; } 
             else if (text && !rawTextString.includes('HOLIDAY') && !rawTextString.includes('VATCLEANING')) { data.cell.styles.fontSize = 4; data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [0, 0, 0]; data.cell.styles.halign = 'center'; data.cell.styles.cellPadding = 0.2; }
           }
        }
      });

      const finalY = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text("Note: If any deviation noticed during the verification, corrective actions should be taken and recorded in the NCR (back-side).", 10, finalY);
      doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200); doc.text("Page 1 of 2", 270, 200);

      // PAGE 2 (NC Report)
      doc.addPage(); doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' }); doc.rect(50, 10, 237, 20); doc.setFontSize(16);
      doc.text("DISA MACHINE OPERATOR CHECK SHEET", 168, 18, { align: 'center' }); doc.setFontSize(14); doc.text("Non-Conformance Report", 168, 26, { align: 'center' });

      const ncRows = ncReports.map((r, index) => [
        index + 1, new Date(r.ReportDate).toLocaleDateString('en-GB'), r.NonConformityDetails || '', r.Correction || '', r.RootCause || '', r.CorrectiveAction || '', r.TargetDate ? new Date(r.TargetDate).toLocaleDateString('en-GB') : '', r.Responsibility || '', r.Sign || '', r.Status || ''
      ]);
      if(ncRows.length === 0) { for(let i=0; i<5; i++) ncRows.push(['', '', '', '', '', '', '', '', '', '']); }

      autoTable(doc, {
        startY: 35, head: [[ 'S.No', 'Date', 'Non-Conformities Details', 'Correction', 'Root Cause', 'Corrective Action', 'Target Date', 'Responsibility', 'Name', 'Status' ]],
        body: ncRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'top', overflow: 'linebreak' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 35 }, 4: { cellWidth: 35 }, 5: { cellWidth: 35 }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 25 }, 8: { cellWidth: 20 }, 9: { cellWidth: 20, halign: 'center' } }
      });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200); doc.text("Page 2 of 2", 270, 200);

      const pdfBlobUrl = doc.output('bloburl'); setPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate PDF preview."); }
    setIsPdfLoading(false);
  };

  const submitSignature = async () => {
    if (sigCanvas.current.isEmpty()) { toast.warning("Please provide a signature first."); return; }
    const signatureData = sigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      await axios.post("http://localhost:5000/api/disa-checklist/sign", { date: selectedReport.reportDate, disaMachine: selectedReport.disa, signature: signatureData });
      toast.success("Checklist approved and signed!"); setSelectedReport(null); fetchReports(); 
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ===============================================
  //  4M CHANGE MONITORING LOGIC
  // ===============================================
  const fetchFourMReports = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/4m-change/hod/${currentHOD}`);
      setFourMReports(res.data);
    } catch (err) { toast.error("Failed to load 4M Change Reports."); }
  };

  const handleOpenFourMModal = async (report) => {
    setSelectedFourMReport(report); setFourMPdfUrl(null); setIsFourMPdfLoading(true); setIsFourMPdfMaximized(false);

    try {
      const response = await axios.get(`http://localhost:5000/api/4m-change/report`, { 
          params: { reportId: report.id },
          responseType: 'blob' 
      });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setFourMPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate 4M PDF."); }
    setIsFourMPdfLoading(false);
  };

  const submitFourMSignature = async () => {
    if (fourMSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = fourMSigCanvas.current.getCanvas().toDataURL("image/png");

    try {
      await axios.post(`http://localhost:5000/api/4m-change/sign-hod`, { 
          reportId: selectedFourMReport.id, signature: signatureData 
      });
      toast.success("4M Change Report signed by HOD!");
      setSelectedFourMReport(null); fetchFourMReports();
    } catch (err) { toast.error("Failed to save 4M signature."); }
  };

  // ===============================================
  //  🔥 NEW: DAILY PRODUCTION PERFORMANCE LOGIC
  // ===============================================
  const fetchDailyReports = async () => {
    try {
      const res = await axios.get(`${DAILY_API_BASE}/hod/${currentHOD}`);
      setDailyReports(res.data);
    } catch (err) { toast.error("Failed to load Daily Performance reports."); }
  };

  const handleOpenDailyModal = async (report) => {
    setSelectedDailyReport(report); setDailyPdfUrl(null); setIsDailyPdfLoading(true); setIsDailyPdfMaximized(false); 
    try {
      const dateStr = new Date(report.productionDate).toISOString().split('T')[0];
      const response = await axios.get(`${DAILY_API_BASE}/download-pdf`, { 
        params: { date: dateStr, disa: report.disa }, 
        responseType: 'blob' 
      });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setDailyPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to load Daily Performance PDF."); }
    setIsDailyPdfLoading(false);
  };

  const submitDailySignature = async () => {
    if (dailySigCanvas.current.isEmpty()) { toast.warning("Please provide a signature first."); return; }
    const signatureData = dailySigCanvas.current.getCanvas().toDataURL("image/png");

    try {
      await axios.post(`${DAILY_API_BASE}/sign-hod`, { reportId: selectedDailyReport.id, signature: signatureData });
      toast.success("Daily Performance Report signed!");
      setSelectedDailyReport(null); fetchDailyReports(); 
    } catch (err) { toast.error("Failed to save Daily Performance signature."); }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="min-h-screen bg-[#2d2d2d] p-10 space-y-10">
        
        {/* SECTION 1: DISA CHECKLIST */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-blue-500">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">HOD Dashboard</h1>
            <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded font-bold uppercase shadow-sm">Logged in: {currentHOD}</span>
          </div>

          <h2 className="text-xl font-bold mb-4 text-gray-700">Disa Machine Checklists Pending Approval</h2>
          {reports.length === 0 ? <p className="text-gray-500 italic">No checklists found for your review.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">DISA Line</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {reports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td><td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.hodSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Approved</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Approval</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.hodSignature && <button onClick={() => handleOpenSignModal(report)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 2: 4M CHANGE MONITORING */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-green-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">4M Change Monitoring</h1></div>
          {fourMReports.length === 0 ? <p className="text-gray-500 italic">No 4M Change forms pending your signature.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Part Name</th><th className="p-3 border border-gray-300">4M Type</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {fourMReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-green-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.recordDate)}</td><td className="p-3 border border-gray-300 font-bold">{report.disa}</td><td className="p-3 border border-gray-300">{report.partName || "N/A"}</td><td className="p-3 border border-gray-300">{report.type4M || "N/A"}</td>
                      <td className="p-3 border border-gray-300">{report.HODSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.HODSignature && <button onClick={() => handleOpenFourMModal(report)} className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 🔥 SECTION 3: DAILY PRODUCTION PERFORMANCE */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-cyan-500">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">Daily Production Performance</h1>
          </div>

          {dailyReports.length === 0 ? (
            <p className="text-gray-500 italic">No Daily Performance reports found for your review.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead className="bg-gray-800 text-white">
                <tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
              </thead>
              <tbody>
                {dailyReports.map((report, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-cyan-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.productionDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">DISA - {report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.hodSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Approved</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Approval</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.hodSignature && <button onClick={() => handleOpenDailyModal(report)} className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* DISA CHECKLIST MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all">
          <div className={`bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isPdfMaximized ? 'w-[98vw] h-[96vh]' : 'w-full max-w-7xl h-[90vh]'}`}>
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center shrink-0"><h3 className="font-bold text-lg">Review & Approve Checklist</h3><button onClick={() => { setSelectedReport(null); setPdfUrl(null); }} className="text-gray-300 hover:text-white font-bold text-2xl leading-none">&times;</button></div>
            <div className="p-6 flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
              <div className="flex-1 bg-gray-100 rounded-lg border border-gray-300 overflow-hidden flex flex-col h-full relative"><div className="bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 uppercase tracking-wide border-b border-gray-300 flex justify-between items-center"><span>Document Preview</span><button onClick={() => setIsPdfMaximized(!isPdfMaximized)} className="hover:text-blue-600 transition-colors flex items-center gap-1">{isPdfMaximized ? <><Minimize2 size={16} /> Shrink</> : <><Maximize2 size={16} /> Expand</>}</button></div>{isPdfLoading ? <div className="flex-1 flex flex-col items-center justify-center bg-gray-50"><Loader className="animate-spin text-orange-500 w-12 h-12 mb-4" /><p className="text-gray-600 font-bold">Generating PDF Preview...</p></div> : pdfUrl ? <iframe src={`${pdfUrl}#toolbar=0`} title="PDF Report Preview" className="w-full flex-1 border-none" /> : <div className="flex-1 flex items-center justify-center text-red-500 font-bold">Could not load PDF</div>}</div>
              {!isPdfMaximized && (
                <div className="w-full md:w-80 shrink-0 flex flex-col h-full overflow-y-auto transition-all">
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-6 text-sm flex flex-col gap-2"><p><span className="font-bold text-gray-700">Date:</span> {formatDate(selectedReport.reportDate)}</p><p><span className="font-bold text-gray-700">Machine:</span> {selectedReport.disa}</p></div>
                  <label className="block text-gray-800 font-bold mb-2 text-sm">Sign below to verify & approve:</label>
                  <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2"><SignatureCanvas ref={sigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-48 cursor-crosshair' }} /></div>
                  <div className="flex justify-end items-center mb-auto"><button onClick={() => { if(sigCanvas.current) sigCanvas.current.clear() }} className="text-sm text-gray-500 hover:text-gray-800 font-bold underline">Clear Pad</button></div>
                  <div className="flex flex-col gap-3 mt-6"><button onClick={submitSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-bold shadow-md transition-colors text-lg">Approve & Sign</button><button onClick={() => { setSelectedReport(null); setPdfUrl(null); }} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded font-bold transition-colors">Cancel</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4M CHANGE MODAL */}
      {selectedFourMReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all">
          <div className={`bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isFourMPdfMaximized ? 'w-[98vw] h-[96vh]' : 'w-full max-w-7xl h-[90vh]'}`}>
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg">Review & Approve 4M Change Report</h3>
                <button onClick={() => { setSelectedFourMReport(null); setFourMPdfUrl(null); }} className="text-gray-300 hover:text-white font-bold text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
              <div className="flex-1 bg-gray-100 rounded-lg border border-gray-300 overflow-hidden flex flex-col h-full relative">
                <div className="bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 flex justify-between">
                    <span>Document Preview</span>
                    <button onClick={() => setIsFourMPdfMaximized(!isFourMPdfMaximized)} className="hover:text-green-600 flex items-center gap-1">{isFourMPdfMaximized ? <><Minimize2 size={16} /> Shrink</> : <><Maximize2 size={16} /> Expand</>}</button>
                </div>
                {isFourMPdfLoading ? <div className="flex-1 flex justify-center items-center"><Loader className="animate-spin text-green-500" /></div> : <iframe src={`${fourMPdfUrl}#toolbar=0`} className="w-full flex-1 border-none" />}
              </div>
              {!isFourMPdfMaximized && (
                <div className="w-full md:w-80 shrink-0 flex flex-col h-full overflow-y-auto transition-all">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6 text-sm flex flex-col gap-2">
                      <p><span className="font-bold text-gray-700">Date:</span> {formatDate(selectedFourMReport.recordDate)}</p>
                      <p><span className="font-bold text-gray-700">Machine:</span> {selectedFourMReport.disa}</p>
                      <p><span className="font-bold text-gray-700">Part:</span> {selectedFourMReport.partName}</p>
                      <p><span className="font-bold text-gray-700">Type:</span> {selectedFourMReport.type4M}</p>
                  </div>
                  <label className="block text-gray-800 font-bold mb-2 text-sm">Sign below to verify & approve:</label>
                  <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2">
                      <SignatureCanvas ref={fourMSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-48 cursor-crosshair' }} />
                  </div>
                  <button onClick={() => fourMSigCanvas.current.clear()} className="text-sm text-gray-500 hover:text-gray-800 font-bold underline mb-auto self-end">Clear Pad</button>
                  <div className="flex flex-col gap-3 mt-6"><button onClick={submitFourMSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-bold shadow-md text-lg">Approve & Sign</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 NEW: DAILY PRODUCTION PERFORMANCE MODAL */}
      {selectedDailyReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all">
          <div className={`bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isDailyPdfMaximized ? 'w-[98vw] h-[96vh]' : 'w-full max-w-7xl h-[90vh]'}`}>
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">Review & Approve Daily Performance</h3>
              <button onClick={() => { setSelectedDailyReport(null); setDailyPdfUrl(null); }} className="text-gray-300 hover:text-white font-bold text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
              <div className="flex-1 bg-gray-100 rounded-lg border border-gray-300 overflow-hidden flex flex-col h-full relative">
                <div className="bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 flex justify-between">
                  <span>Document Preview</span>
                  <button onClick={() => setIsDailyPdfMaximized(!isDailyPdfMaximized)} className="hover:text-cyan-600 flex items-center gap-1">{isDailyPdfMaximized ? <><Minimize2 size={16} /> Shrink</> : <><Maximize2 size={16} /> Expand</>}</button>
                </div>
                {isDailyPdfLoading ? <div className="flex-1 flex justify-center items-center"><Loader className="animate-spin text-cyan-500 w-12 h-12 mb-4" /></div> : <iframe src={`${dailyPdfUrl}#toolbar=0`} className="w-full flex-1 border-none" />}
              </div>

              {!isDailyPdfMaximized && (
                <div className="w-full md:w-80 shrink-0 flex flex-col h-full overflow-y-auto transition-all">
                  <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200 mb-6 text-sm flex flex-col gap-2">
                    <p><span className="font-bold text-gray-700">Date:</span> {formatDate(selectedDailyReport.productionDate)}</p>
                    <p><span className="font-bold text-gray-700">Machine:</span> DISA - {selectedDailyReport.disa}</p>
                  </div>
                  <label className="block text-gray-800 font-bold mb-2 text-sm">Sign below to verify & approve:</label>
                  <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2">
                    <SignatureCanvas ref={dailySigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-48 cursor-crosshair' }} />
                  </div>
                  <button onClick={() => dailySigCanvas.current.clear()} className="text-sm text-gray-500 hover:text-gray-800 font-bold underline mb-auto self-end">Clear Pad</button>
                  <div className="flex flex-col gap-3 mt-6">
                    <button onClick={submitDailySignature} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-3 rounded font-bold shadow-md">Approve & Sign</button>
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

export default Hod;