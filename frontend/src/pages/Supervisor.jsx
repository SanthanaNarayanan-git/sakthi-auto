import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Header from "../components/Header";
import SignatureCanvas from "react-signature-canvas";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader, Maximize2, Minimize2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Supervisor = () => {
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentSupervisor = storedUser.username || "supervisor1";

  // --- States for Disamatic Report ---
  const [disaReports, setDisaReports] = useState([]);
  const [selectedDisaReport, setSelectedDisaReport] = useState(null);
  const disaSigCanvas = useRef({});

  // --- States for Bottom Level Audit ---
  const [bottomReports, setBottomReports] = useState([]);
  const [selectedBottomReport, setSelectedBottomReport] = useState(null);
  const [bottomPdfUrl, setBottomPdfUrl] = useState(null);
  const [isBottomPdfLoading, setIsBottomPdfLoading] = useState(false);
  const [isBottomPdfMaximized, setIsBottomPdfMaximized] = useState(false);
  const bottomSigCanvas = useRef({});

  // --- States for Non-Conformance Reports (NCR) ---
  const [ncrReports, setNcrReports] = useState([]);
  const [selectedNcrReport, setSelectedNcrReport] = useState(null);
  const ncrSigCanvas = useRef({});

  // --- States for DMM Setting Parameters ---
  const [dmmReports, setDmmReports] = useState([]);
  const [selectedDmmReport, setSelectedDmmReport] = useState(null);
  const [dmmPdfUrl, setDmmPdfUrl] = useState(null);
  const [isDmmPdfLoading, setIsDmmPdfLoading] = useState(false);
  const [isDmmPdfMaximized, setIsDmmPdfMaximized] = useState(false);
  const dmmSigCanvas = useRef({});

  // --- States for 4M Change Reports ---
  const [fourMReports, setFourMReports] = useState([]);
  const [selectedFourMReport, setSelectedFourMReport] = useState(null);
  const [fourMPdfUrl, setFourMPdfUrl] = useState(null);
  const [isFourMPdfLoading, setIsFourMPdfLoading] = useState(false);
  const [isFourMPdfMaximized, setIsFourMPdfMaximized] = useState(false);
  const fourMSigCanvas = useRef({});

  // --- States for Error Proof Reaction Plans (V1) ---
  const [errorReports, setErrorReports] = useState([]);
  const [selectedErrorReport, setSelectedErrorReport] = useState(null);
  const errorSigCanvas = useRef({});

  // --- 🔥 NEW States for Error Proof Reaction Plans V2 (3-Shift) ---
  const [errorReportsV2, setErrorReportsV2] = useState([]);
  const [selectedErrorReportV2, setSelectedErrorReportV2] = useState(null);
  const errorSigCanvasV2 = useRef({});

  // API Bases
  const ERR_API_BASE_V2 = 'http://localhost:5000/api/error-proof2'; // V2 Routes

  useEffect(() => {
    fetchDisaReports();
    fetchBottomReports();
    fetchNcrReports(); 
    fetchDmmReports();
    fetchFourMReports();
    fetchErrorReports(); 
    fetchErrorReportsV2(); // 🔥 Fetch V2 Reaction Plans
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateString) => { 
      if (!dateString) return "";
      return new Date(dateString).toLocaleDateString("en-GB"); 
  };

  // ==========================================
  // 1. DISAMATIC LOGIC
  // ==========================================
  const fetchDisaReports = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/forms/supervisor/${currentSupervisor}`);
      setDisaReports(res.data);
    } catch (err) { toast.error("Failed to load Disamatic reports."); }
  };

  const submitDisaSignature = async () => {
    if (disaSigCanvas.current.isEmpty()) { toast.warning("Please provide a signature."); return; }
    const signatureData = disaSigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      await axios.post("http://localhost:5000/api/forms/sign", { reportId: selectedDisaReport.id, signature: signatureData });
      toast.success("Disamatic Report signed successfully!");
      setSelectedDisaReport(null); fetchDisaReports();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ==========================================
  // 2. BOTTOM LEVEL AUDIT LOGIC
  // ==========================================
  const fetchBottomReports = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/bottom-level-audit/supervisor/${currentSupervisor}`);
      setBottomReports(res.data);
    } catch (err) { toast.error("Failed to load Bottom Level Audits."); }
  };

  const handleOpenBottomModal = async (report) => {
    setSelectedBottomReport(report); setBottomPdfUrl(null); setIsBottomPdfLoading(true); setIsBottomPdfMaximized(false);
    try {
      const selectedDate = new Date(report.reportDate);
      const offset = selectedDate.getTimezoneOffset();
      const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
      const dateStr = localDate.toISOString().split('T')[0];
      const month = localDate.getMonth() + 1; const year = localDate.getFullYear();
      const disaMachine = report.disa;

      const [detailsRes, monthlyRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/bottom-level-audit/details`, { params: { date: dateStr, disaMachine } }),
        axios.get(`http://localhost:5000/api/bottom-level-audit/monthly-report`, { params: { month, year, disaMachine } })
      ]);

      const checklist = detailsRes.data.checklist; const monthlyLogs = monthlyRes.data.monthlyLogs || []; const ncReports = monthlyRes.data.ncReports || [];
      const historyMap = {}; const holidayDays = new Set(); const vatDays = new Set();
      const supSigMap = {}; const hofSig = monthlyLogs.find(l => l.HOFSignature)?.HOFSignature;

      monthlyLogs.forEach(log => {
        const logDay = log.DayVal; const key = String(log.MasterId);
        if (Number(log.IsHoliday) === 1) holidayDays.add(logDay);
        if (Number(log.IsVatCleaning) === 1) vatDays.add(logDay);
        if (log.SupervisorSignature) supSigMap[logDay] = log.SupervisorSignature;
        if (!historyMap[key]) historyMap[key] = {};
        if (log.IsNA == 1) { historyMap[key][logDay] = 'NA'; } else if (log.IsDone == 1) { historyMap[key][logDay] = 'Y'; } else { historyMap[key][logDay] = 'N'; }
      });

      const doc = new jsPDF('l', 'mm', 'a4');
      const monthName = localDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(year, month, 0).getDate();

      doc.setLineWidth(0.3); doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
      doc.rect(50, 10, 237, 20); doc.setFontSize(16); doc.text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", 168, 22, { align: 'center' });
      doc.setFontSize(10); doc.text(`${disaMachine}`, 12, 35); doc.text(`MONTH : ${monthName}`, 235, 35);

      const days = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
      const tableBody = checklist.map((item, rowIndex) => {
        const row = [String(item.SlNo), item.CheckPointDesc];
        for (let i = 1; i <= daysInMonth; i++) {
          if (holidayDays.has(i)) { if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } }); }
          else if (vatDays.has(i)) { if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } }); }
          else { row.push(historyMap[String(item.MasterId)]?.[i] || ''); }
        }
        return row;
      });

      const supRow = ["", "Supervisor"]; for (let i = 1; i <= daysInMonth; i++) { supRow.push(""); }
      const hofRow = ["", "HOF"]; for (let i = 1; i <= daysInMonth - 5; i++) { hofRow.push(""); }
      hofRow.push({ content: '', colSpan: 5, styles: { halign: 'center', valign: 'middle' } });
      const footerRows = [supRow, hofRow];
      const dynamicColumnStyles = {}; for (let i = 2; i < daysInMonth + 2; i++) { dynamicColumnStyles[i] = { cellWidth: 5, halign: 'center' }; }

      autoTable(doc, {
        startY: 38, head: [[{ content: 'S.No', styles: { halign: 'center', valign: 'middle' } }, { content: 'Check Points', styles: { halign: 'center', valign: 'middle' } }, ...days.map(d => ({ content: d, styles: { halign: 'center' } }))]],
        body: [...tableBody, ...footerRows], theme: 'grid', styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 105 }, ...dynamicColumnStyles },
        didDrawCell: function (data) {
          if (data.row.index === tableBody.length && data.column.index > 1) {
            const sigData = supSigMap[data.column.index - 1];
            if (sigData && sigData.startsWith('data:image')) { try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch (e) { } }
          }
          if (data.row.index === tableBody.length + 1 && data.cell.colSpan === 5) {
            if (hofSig && hofSig.startsWith('data:image')) { try { doc.addImage(hofSig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) { } }
          }
        },
        didParseCell: function (data) {
          if (data.row.index >= tableBody.length && data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'right'; }
          if (data.column.index > 1 && data.row.index < tableBody.length) {
            const text = (data.cell.text || [])[0] || '';
            if (text === 'Y') { data.cell.styles.font = 'ZapfDingbats'; data.cell.text = '3'; data.cell.styles.textColor = [0, 100, 0]; }
            else if (text === 'N') { data.cell.styles.textColor = [255, 0, 0]; data.cell.text = 'X'; data.cell.styles.fontStyle = 'bold'; }
            else if (text === 'NA') { data.cell.styles.fontSize = 5; data.cell.styles.textColor = [100, 100, 100]; data.cell.styles.fontStyle = 'bold'; }
          }
        }
      });

      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text("Legend:   3 - OK     X - NOT OK     CA - Corrected during Audit     NA - Not Applicable", 10, doc.lastAutoTable.finalY + 6);
      doc.setFont('helvetica', 'normal'); doc.text("Remarks: If Nonconformity please write on NCR format (back-side)", 10, doc.lastAutoTable.finalY + 12);
      doc.text("QF/08/MRO - 18, Rev No: 02 dt 01.01.2022", 10, 200); doc.text("Page 1 of 2", 270, 200);

      doc.addPage(); doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' }); doc.rect(50, 10, 237, 20); doc.setFontSize(16);
      doc.text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", 168, 18, { align: 'center' }); doc.setFontSize(14); doc.text("Non-Conformance Report", 168, 26, { align: 'center' });

      const ncRows = ncReports.map((r, index) => [ index + 1, new Date(r.ReportDate).toLocaleDateString('en-GB'), r.NonConformityDetails || '', r.Correction || '', r.RootCause || '', r.CorrectiveAction || '', r.TargetDate ? new Date(r.TargetDate).toLocaleDateString('en-GB') : '', r.Responsibility || '', '', r.Status || '' ]);
      if (ncRows.length === 0) { for (let i = 0; i < 5; i++) ncRows.push(['', '', '', '', '', '', '', '', '', '']); }

      autoTable(doc, {
        startY: 35, head: [['S.No', 'Date', 'Non-Conformities Details', 'Correction', 'Root Cause', 'Corrective Action', 'Target Date', 'Responsibility', 'Signature', 'Status']],
        body: ncRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 35 }, 4: { cellWidth: 35 }, 5: { cellWidth: 35 }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 25 }, 8: { cellWidth: 20, halign: 'center' }, 9: { cellWidth: 20, halign: 'center' } },
        didDrawCell: function(data) {
           if (data.section === 'body' && data.column.index === 8) {
               const rowData = ncReports[data.row.index];
               if (rowData && rowData.SupervisorSignature && rowData.SupervisorSignature.startsWith('data:image')) {
                   try { doc.addImage(rowData.SupervisorSignature, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch(e){}
               }
           }
        },
        didParseCell: function(data) {
           if (data.section === 'body' && data.column.index === 9) {
               const statusText = (data.cell.text || [])[0] || '';
               if (statusText === 'Completed') { data.cell.styles.textColor = [0, 150, 0]; data.cell.styles.fontStyle = 'bold'; } 
               else if (statusText === 'Pending') { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
           }
        }
      });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text("QF/08/MRO - 18, Rev No: 02 dt 01.01.2022", 10, 200); doc.text("Page 2 of 2", 270, 200);

      const pdfBlobUrl = doc.output('bloburl'); setBottomPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate PDF preview."); }
    setIsBottomPdfLoading(false);
  };

  const submitBottomSignature = async () => {
    if (bottomSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = bottomSigCanvas.current.getCanvas().toDataURL("image/png");
    const localDate = new Date(selectedBottomReport.reportDate);
    const offset = localDate.getTimezoneOffset();
    const cleanDate = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    try {
      await axios.post(`http://localhost:5000/api/bottom-level-audit/sign-supervisor`, { date: cleanDate, disaMachine: selectedBottomReport.disa, signature: signatureData });
      toast.success("Bottom Level Audit approved!"); setSelectedBottomReport(null); fetchBottomReports();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ==========================================
  // 3. NCR LOGIC
  // ==========================================
  const fetchNcrReports = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/bottom-level-audit/supervisor-ncr/${currentSupervisor}`);
      setNcrReports(res.data);
    } catch (err) { toast.error("Failed to load NCRs."); }
  };

  const submitNcrSignature = async () => {
    if (ncrSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = ncrSigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      await axios.post(`http://localhost:5000/api/bottom-level-audit/sign-ncr`, { reportId: selectedNcrReport.ReportId, signature: signatureData });
      toast.success("NCR Verified and Completed!"); setSelectedNcrReport(null); fetchNcrReports(); 
    } catch (err) { toast.error("Failed to save NCR signature."); }
  };

  // ==========================================
  // 4. DMM SETTINGS LOGIC
  // ==========================================
  const fetchDmmReports = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/dmm-settings/supervisor/${currentSupervisor}`);
      setDmmReports(res.data);
    } catch (err) { toast.error("Failed to load DMM Settings."); }
  };

  const handleOpenDmmModal = async (report) => {
    setSelectedDmmReport(report); setDmmPdfUrl(null); setIsDmmPdfLoading(true); setIsDmmPdfMaximized(false);
    try {
      const selectedDate = new Date(report.reportDate);
      const offset = selectedDate.getTimezoneOffset();
      const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
      const dateStr = localDate.toISOString().split('T')[0];
      const disaMachine = report.disa;

      const res = await axios.get(`http://localhost:5000/api/dmm-settings/details`, { params: { date: dateStr, disa: disaMachine } });
      const { shiftsData, shiftsMeta } = res.data;

      const doc = new jsPDF('l', 'mm', 'a4'); 
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text("SAKTHI AUTO COMPONENT LIMITED", 148.5, 10, { align: 'center' });
      doc.setFontSize(16); doc.text("DMM SETTING PARAMETERS CHECK SHEET", 148.5, 18, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(` ${disaMachine}`, 10, 28); doc.text(`DATE: ${localDate.toLocaleDateString('en-GB')}`, 280, 28, { align: 'right' });

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
           if (data.section === 'body' && data.column.index === 3) {
               const shiftNum = data.row.index + 1;
               const sigData = shiftsMeta[shiftNum]?.supervisorSignature;
               if (sigData && sigData.startsWith('data:image')) {
                   try { doc.addImage(sigData, 'PNG', data.cell.x + 2, data.cell.y + 1, data.cell.width - 4, data.cell.height - 2); } catch (e) {}
               }
           }
        }
      });

      const columns = [ { key: 'Customer', label: 'CUSTOMER' }, { key: 'ItemDescription', label: 'ITEM\nDESCRIPTION' }, { key: 'Time', label: 'TIME' }, { key: 'PpThickness', label: 'PP\nTHICKNESS\n(mm)' }, { key: 'PpHeight', label: 'PP\nHEIGHT\n(mm)' }, { key: 'SpThickness', label: 'SP\nTHICKNESS\n(mm)' }, { key: 'SpHeight', label: 'SP\nHEIGHT\n(mm)' }, { key: 'CoreMaskOut', label: 'CORE MASK\nHEIGHT\n(OUTSIDE) mm' }, { key: 'CoreMaskIn', label: 'CORE MASK\nHEIGHT\n(INSIDE) mm' }, { key: 'SandShotPressure', label: 'SAND SHOT\nPRESSURE\nBAR' }, { key: 'CorrectionShotTime', label: 'CORRECTION\nOF SHOT TIME\n(SEC)' }, { key: 'SqueezePressure', label: 'SQUEEZE\nPRESSURE\nKg/Cm2 / bar' }, { key: 'PpStripAccel', label: 'PP STRIPPING\nACCELERATION' }, { key: 'PpStripDist', label: 'PP STRIPPING\nDISTANCE' }, { key: 'SpStripAccel', label: 'SP STRIPPING\nACCELERATION' }, { key: 'SpStripDist', label: 'SP STRIPPING\nDISTANCE' }, { key: 'MouldThickness', label: 'MOULD\nTHICKNESS\n(± 10mm)' }, { key: 'CloseUpForce', label: 'CLOSE UP\nFORCE (Kg)' }, { key: 'Remarks', label: 'REMARKS' } ];

      let currentY = doc.lastAutoTable.finalY + 8; 
      [1, 2, 3].forEach((shift, index) => {
         const isIdle = shiftsMeta[shift].isIdle;
         const shiftLabel = shift === 1 ? 'I' : shift === 2 ? 'II' : 'III';
         const tableHeader = [ [{ content: `SHIFT ${shiftLabel}`, colSpan: columns.length + 1, styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [0,0,0] } }], [{ content: 'S.No', styles: { cellWidth: 8 } }, ...columns.map(col => ({ content: col.label, styles: { cellWidth: 'wrap' } }))] ];

         let tableBody = [];
         if (isIdle) { tableBody.push([{ content: 'L I N E   I D L E', colSpan: columns.length + 1, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 14, textColor: [100, 100, 100], fillColor: [245, 245, 245], minCellHeight: 15 } }]); } 
         else {
            tableBody = (shiftsData[shift] || []).map((row, idx) => {
                const pdfRow = [(idx + 1).toString()];
                columns.forEach(col => { const val = row[col.key]; pdfRow.push(val === '' || val === null || val === undefined ? '-' : val.toString()); });
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
         if (currentY > 175 && index < 2) { doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200); doc.addPage(); currentY = 15; }
      });
      doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);

      const pdfBlobUrl = doc.output('bloburl'); setDmmPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate PDF preview."); }
    setIsDmmPdfLoading(false);
  };

  const submitDmmSignature = async () => {
    if (dmmSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = dmmSigCanvas.current.getCanvas().toDataURL("image/png");
    const localDate = new Date(selectedDmmReport.reportDate);
    const offset = localDate.getTimezoneOffset();
    const cleanDate = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    try {
      await axios.post(`http://localhost:5000/api/dmm-settings/sign`, { date: cleanDate, disaMachine: selectedDmmReport.disa, shift: selectedDmmReport.shift, signature: signatureData });
      toast.success("DMM Settings Shift signed successfully!");
      setSelectedDmmReport(null); fetchDmmReports();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ==========================================
  // 5. 4M CHANGE LOGIC
  // ==========================================
  const fetchFourMReports = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/4m-change/supervisor/${currentSupervisor}`);
      setFourMReports(res.data);
    } catch (err) { toast.error("Failed to load 4M Change Reports."); }
  };

  const handleOpenFourMModal = async (report) => {
    setSelectedFourMReport(report); setFourMPdfUrl(null); setIsFourMPdfLoading(true); setIsFourMPdfMaximized(false);
    try {
      const response = await axios.get(`http://localhost:5000/api/4m-change/report`, { params: { reportId: report.id }, responseType: 'blob' });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setFourMPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate 4M PDF."); }
    setIsFourMPdfLoading(false);
  };

  const submitFourMSignature = async () => {
    if (fourMSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = fourMSigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      await axios.post(`http://localhost:5000/api/4m-change/sign-supervisor`, { reportId: selectedFourMReport.id, signature: signatureData });
      toast.success("4M Change Report signed successfully!");
      setSelectedFourMReport(null); fetchFourMReports();
    } catch (err) { toast.error("Failed to save 4M signature."); }
  };

  // ==========================================
  // 6. ERROR PROOF REACTION PLANS LOGIC (V1)
  // ==========================================
  const fetchErrorReports = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/error-proof/supervisor/${currentSupervisor}`);
      setErrorReports(res.data);
    } catch (err) { toast.error("Failed to load Error Proof plans."); }
  };

  const submitErrorSignature = async () => {
    if (errorSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = errorSigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      const id = selectedErrorReport.VerificationId || selectedErrorReport.Id || selectedErrorReport.sNo;
      await axios.post(`http://localhost:5000/api/error-proof/sign-supervisor`, { 
        verificationId: id, signature: signatureData 
      });
      toast.success("Reaction Plan Approved!");
      setSelectedErrorReport(null); fetchErrorReports();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ==========================================
  // 🔥 7. NEW: ERROR PROOF V2 REACTION PLANS LOGIC
  // ==========================================
  const fetchErrorReportsV2 = async () => {
    try {
      const res = await axios.get(`${ERR_API_BASE_V2}/supervisor/${currentSupervisor}`);
      setErrorReportsV2(res.data);
    } catch (err) { toast.error("Failed to load Error Proof V2 plans."); }
  };

  const submitErrorSignatureV2 = async () => {
    if (errorSigCanvasV2.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = errorSigCanvasV2.current.getCanvas().toDataURL("image/png");
    try {
      // Send the specific Id mapping to the V2 Backend
      await axios.post(`${ERR_API_BASE_V2}/sign-supervisor`, { 
        reactionPlanId: selectedErrorReportV2.ReactionPlanId, signature: signatureData 
      });
      toast.success("Reaction Plan V2 Approved!");
      setSelectedErrorReportV2(null); fetchErrorReportsV2();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="min-h-screen bg-[#2d2d2d] p-10 space-y-10">

        {/* SECTION 1: DISAMATIC REPORTS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-orange-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-800">Disamatic Production Reports</h1>
            <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded font-bold uppercase shadow-sm">Logged in: {currentSupervisor}</span>
          </div>
          {disaReports.length === 0 ? <p className="text-gray-500 italic">No Disamatic reports pending.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Shift</th><th className="p-3 border border-gray-300">DISA Line</th><th className="p-3 border border-gray-300">Operator</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {disaReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td><td className="p-3 border border-gray-300">{report.shift}</td><td className="p-3 border border-gray-300 font-bold">DISA - {report.disa}</td><td className="p-3 border border-gray-300">{report.ppOperator || "N/A"}</td>
                      <td className="p-3 border border-gray-300">{report.supervisorSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.supervisorSignature && <button onClick={() => setSelectedDisaReport(report)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 2: BOTTOM LEVEL AUDITS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-blue-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">Daily Bottom Level Audits</h1></div>
          {bottomReports.length === 0 ? <p className="text-gray-500 italic">No bottom level audits pending your signature.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {bottomReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td><td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.supervisorSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.supervisorSignature && <button onClick={() => handleOpenBottomModal(report)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 3: NON-CONFORMANCE REPORTS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-red-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">Non-Conformance Reports (NCR)</h1></div>
          {ncrReports.length === 0 ? <p className="text-gray-500 italic">No NCRs to review.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">NC Details</th><th className="p-3 border border-gray-300">Responsibility</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {ncrReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-red-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.ReportDate)}</td><td className="p-3 border border-gray-300 font-bold">{report.DisaMachine}</td><td className="p-3 border border-gray-300 text-sm">{report.NonConformityDetails}</td><td className="p-3 border border-gray-300 font-bold">{report.Responsibility}</td>
                      <td className="p-3 border border-gray-300">{report.Status === 'Completed' ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Completed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{report.Status !== 'Completed' && <button onClick={() => setSelectedNcrReport(report)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Verify & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 4: DMM SETTING PARAMETERS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-indigo-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">DMM Setting Parameters</h1></div>
          {dmmReports.length === 0 ? <p className="text-gray-500 italic">No DMM Setting forms pending your signature.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Shift</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Operator</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {dmmReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">Shift {report.shift}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.OperatorName || "N/A"}</td>
                      <td className="p-3 border border-gray-300">{report.SupervisorSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.SupervisorSignature && <button onClick={() => handleOpenDmmModal(report)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 5: 4M CHANGE MONITORING */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-green-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">4M Change Monitoring</h1></div>
          {fourMReports.length === 0 ? <p className="text-gray-500 italic">No 4M Change forms pending your signature.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Part Name</th><th className="p-3 border border-gray-300">4M Type</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {fourMReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-green-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.recordDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.partName || "N/A"}</td>
                      <td className="p-3 border border-gray-300">{report.type4M || "N/A"}</td>
                      <td className="p-3 border border-gray-300">{report.SupervisorSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.SupervisorSignature && <button onClick={() => handleOpenFourMModal(report)} className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 6: ERROR PROOF REACTION PLANS (V1) */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-yellow-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-800">Error Proof Reaction Plans (Daily)</h1>
          </div>
          {errorReports.length === 0 ? (
            <p className="text-gray-500 italic">No Reaction Plans pending your approval.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white">
                  <tr><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Error Proof</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
                </thead>
                <tbody>
                  {errorReports.map((report, idx) => {
                    const status = report.Status || report.status;
                    return (
                      <tr key={idx} className="hover:bg-yellow-50">
                        <td className="p-3 border border-gray-300 font-bold">{report.DisaMachine || report.disaMachine || report.line}</td>
                        <td className="p-3 border border-gray-300">{report.ErrorProofName || report.errorProofName}</td>
                        <td className="p-3 border border-gray-300">{status === 'Completed' ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Completed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending</span>}</td>
                        <td className="p-3 border border-gray-300 text-center">
                          {status !== 'Completed' && (
                            <button onClick={() => setSelectedErrorReport(report)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">
                              Review & Sign
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 🔥 SECTION 7: NEW ERROR PROOF V2 REACTION PLANS (3-Shifts) */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-purple-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-800">Error Proof Reaction Plans V2 (Shift Wise)</h1>
          </div>
          {errorReportsV2.length === 0 ? (
            <p className="text-gray-500 italic">No Reaction Plans V2 pending your approval.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white">
                  <tr><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Error Proof</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
                </thead>
                <tbody>
                  {errorReportsV2.map((report, idx) => {
                    // 🔥 FIX: Safe fallbacks mapping exactly to the backend columns
                    const currentStatus = report.Status || report.status || "Pending";
                    const errorName = report.ErrorProofName || report.errorProofName || "N/A";

                    return (
                      <tr key={idx} className="hover:bg-purple-50">
                        <td className="p-3 border border-gray-300 font-bold">{report.DisaMachine}</td>
                        <td className="p-3 border border-gray-300">{errorName}</td>
                        <td className="p-3 border border-gray-300">{currentStatus === 'Completed' ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Completed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending</span>}</td>
                        <td className="p-3 border border-gray-300 text-center">
                          {currentStatus !== 'Completed' && (
                            <button onClick={() => setSelectedErrorReportV2(report)} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">
                              Review & Sign
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* MODALS */}
      {/* 1. DISAMATIC MODAL */}
      {selectedDisaReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center shrink-0"><h3 className="font-bold text-lg">Review & Sign Disamatic Report</h3><button onClick={() => setSelectedDisaReport(null)} className="text-gray-300 hover:text-white font-bold text-2xl leading-none">&times;</button></div>
            <div className="p-6 flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
              <div className="flex-1 bg-gray-100 rounded-lg border border-gray-300 overflow-hidden flex flex-col h-full"><div className="bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 uppercase tracking-wide border-b border-gray-300">Document Preview</div><iframe src={`http://localhost:5000/api/forms/download-pdf?reportId=${selectedDisaReport.id}#toolbar=0`} title="PDF Report Preview" className="w-full flex-1" /></div>
              <div className="w-full md:w-80 shrink-0 flex flex-col h-full overflow-y-auto">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-6 text-sm flex flex-col gap-2"><p><span className="font-bold text-gray-700">Date:</span> {formatDate(selectedDisaReport.reportDate)}</p><p><span className="font-bold text-gray-700">Shift:</span> {selectedDisaReport.shift}</p><p><span className="font-bold text-gray-700">DISA:</span> {selectedDisaReport.disa}</p></div>
                <label className="block text-gray-800 font-bold mb-2 text-sm">Sign below to verify & approve:</label><div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2"><SignatureCanvas ref={disaSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-48 cursor-crosshair' }} /></div><button onClick={() => disaSigCanvas.current.clear()} className="text-sm text-gray-500 hover:text-gray-800 font-bold underline mb-auto self-end">Clear Pad</button>
                <div className="flex flex-col gap-3 mt-6"><button onClick={submitDisaSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-bold shadow-md text-lg">Approve & Sign</button></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. BOTTOM LEVEL AUDIT MODAL */}
      {selectedBottomReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all">
          <div className={`bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isBottomPdfMaximized ? 'w-[98vw] h-[96vh]' : 'w-full max-w-7xl h-[90vh]'}`}>
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center shrink-0"><h3 className="font-bold text-lg">Review & Approve Bottom Level Audit</h3><button onClick={() => { setSelectedBottomReport(null); setBottomPdfUrl(null); }} className="text-gray-300 hover:text-white font-bold text-2xl">&times;</button></div>
            <div className="p-6 flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
              <div className="flex-1 bg-gray-100 rounded-lg border border-gray-300 overflow-hidden flex flex-col h-full relative"><div className="bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 flex justify-between"><span>Document Preview</span><button onClick={() => setIsBottomPdfMaximized(!isBottomPdfMaximized)} className="hover:text-blue-600 flex items-center gap-1">{isBottomPdfMaximized ? <><Minimize2 size={16} /> Shrink</> : <><Maximize2 size={16} /> Expand</>}</button></div>{isBottomPdfLoading ? <div className="flex-1 flex justify-center items-center"><Loader className="animate-spin text-blue-500" /></div> : <iframe src={`${bottomPdfUrl}#toolbar=0`} className="w-full flex-1 border-none" />}</div>
              {!isBottomPdfMaximized && (
                <div className="w-full md:w-80 shrink-0 flex flex-col h-full overflow-y-auto transition-all">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6 text-sm flex flex-col gap-2"><p><span className="font-bold text-gray-700">Date:</span> {formatDate(selectedBottomReport.reportDate)}</p><p><span className="font-bold text-gray-700">Machine:</span> {selectedBottomReport.disa}</p></div>
                  <label className="block text-gray-800 font-bold mb-2 text-sm">Sign below to verify & approve:</label><div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2"><SignatureCanvas ref={bottomSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-48 cursor-crosshair' }} /></div><button onClick={() => bottomSigCanvas.current.clear()} className="text-sm text-gray-500 hover:text-gray-800 font-bold underline mb-auto self-end">Clear Pad</button>
                  <div className="flex flex-col gap-3 mt-6"><button onClick={submitBottomSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-bold shadow-md text-lg">Approve & Sign</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. NCR MODAL */}
      {selectedNcrReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center shrink-0"><h3 className="font-bold text-lg">Verify Non-Conformance Report</h3><button onClick={() => setSelectedNcrReport(null)} className="text-red-200 hover:text-white font-bold text-2xl leading-none">&times;</button></div>
            <div className="p-6 overflow-y-auto">
               <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6 flex flex-col gap-3 text-sm text-gray-800">
                  <div className="flex justify-between border-b border-red-200 pb-2"><p><span className="font-bold">Date:</span> {formatDate(selectedNcrReport.ReportDate)}</p><p><span className="font-bold">Machine:</span> {selectedNcrReport.DisaMachine}</p></div>
                  <p><span className="font-bold">NC Details:</span> {selectedNcrReport.NonConformityDetails || 'N/A'}</p><p><span className="font-bold">Correction:</span> {selectedNcrReport.Correction || 'N/A'}</p><p><span className="font-bold">Root Cause:</span> {selectedNcrReport.RootCause || 'N/A'}</p><p><span className="font-bold">Corrective Action:</span> {selectedNcrReport.CorrectiveAction || 'N/A'}</p>
                  <div className="flex justify-between pt-2"><p><span className="font-bold text-red-600">Target Date:</span> {selectedNcrReport.TargetDate ? formatDate(selectedNcrReport.TargetDate) : 'N/A'}</p></div>
               </div>
               <label className="block text-gray-800 font-bold mb-2 text-sm">Sign below to confirm resolution:</label><div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2"><SignatureCanvas ref={ncrSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-40 cursor-crosshair' }} /></div><div className="flex justify-end mb-6"><button onClick={() => ncrSigCanvas.current.clear()} className="text-sm text-red-500 hover:text-red-700 font-bold underline">Clear Pad</button></div>
               <div className="flex flex-col gap-3"><button onClick={submitNcrSignature} className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded font-bold shadow-md text-lg">Verify & Complete NCR</button></div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DMM SETTINGS MODAL */}
      {selectedDmmReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-all">
          <div className={`bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isDmmPdfMaximized ? 'w-[98vw] h-[96vh]' : 'w-full max-w-7xl h-[90vh]'}`}>
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center shrink-0"><h3 className="font-bold text-lg">Review & Approve DMM Settings</h3><button onClick={() => { setSelectedDmmReport(null); setDmmPdfUrl(null); }} className="text-gray-300 hover:text-white font-bold text-2xl">&times;</button></div>
            <div className="p-6 flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
              <div className="flex-1 bg-gray-100 rounded-lg border border-gray-300 overflow-hidden flex flex-col h-full relative"><div className="bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 flex justify-between"><span>Document Preview</span><button onClick={() => setIsDmmPdfMaximized(!isDmmPdfMaximized)} className="hover:text-blue-600 flex items-center gap-1">{isDmmPdfMaximized ? <><Minimize2 size={16} /> Shrink</> : <><Maximize2 size={16} /> Expand</>}</button></div>{isDmmPdfLoading ? <div className="flex-1 flex justify-center items-center"><Loader className="animate-spin text-indigo-500" /></div> : <iframe src={`${dmmPdfUrl}#toolbar=0`} className="w-full flex-1 border-none" />}</div>
              {!isDmmPdfMaximized && (
                <div className="w-full md:w-80 shrink-0 flex flex-col h-full overflow-y-auto transition-all">
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 mb-6 text-sm flex flex-col gap-2"><p><span className="font-bold text-gray-700">Date:</span> {formatDate(selectedDmmReport.reportDate)}</p><p><span className="font-bold text-gray-700">Machine:</span> {selectedDmmReport.disa}</p><p><span className="font-bold text-gray-700">Shift:</span> Shift {selectedDmmReport.shift}</p></div>
                  <label className="block text-gray-800 font-bold mb-2 text-sm">Sign below to verify Shift {selectedDmmReport.shift}:</label><div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2"><SignatureCanvas ref={dmmSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-48 cursor-crosshair' }} /></div><button onClick={() => dmmSigCanvas.current.clear()} className="text-sm text-gray-500 hover:text-gray-800 font-bold underline mb-auto self-end">Clear Pad</button>
                  <div className="flex flex-col gap-3 mt-6"><button onClick={submitDmmSignature} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded font-bold shadow-md text-lg">Approve & Sign</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. 4M CHANGE MODAL */}
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

      {/* 6. ERROR PROOF REACTION PLAN MODAL (V1) */}
      {selectedErrorReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-yellow-600 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">Approve Reaction Plan (Daily)</h3>
              <button onClick={() => setSelectedErrorReport(null)} className="text-yellow-200 hover:text-white font-bold text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6 flex flex-col gap-3 text-sm text-gray-800">
                  <p><span className="font-bold">Machine:</span> {selectedErrorReport.DisaMachine || selectedErrorReport.disaMachine || selectedErrorReport.line}</p>
                  <p><span className="font-bold">Problem:</span> {selectedErrorReport.Problem || selectedErrorReport.problem}</p>
                  <p><span className="font-bold">Action Taken:</span> {selectedErrorReport.CorrectiveAction || selectedErrorReport.correctiveAction}</p>
                </div>
                <label className="block text-gray-800 font-bold mb-2 text-sm">Supervisor Signature:</label>
                <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2">
                  <SignatureCanvas ref={errorSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-40 cursor-crosshair' }} />
                </div>
                <button onClick={() => errorSigCanvas.current.clear()} className="text-sm text-yellow-600 hover:text-yellow-800 font-bold underline mb-auto self-end float-right">Clear Pad</button>
                <div className="flex flex-col gap-3 mt-8">
                  <button onClick={submitErrorSignature} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded font-bold shadow-md text-lg">Approve Plan</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 7. NEW ERROR PROOF REACTION PLAN MODAL V2 (3-Shifts) */}
      {selectedErrorReportV2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-purple-600 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">Approve Reaction Plan V2 (Shift Wise)</h3>
              <button onClick={() => setSelectedErrorReportV2(null)} className="text-purple-200 hover:text-white font-bold text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-6 flex flex-col gap-3 text-sm text-gray-800">
                  <p><span className="font-bold">Machine:</span> {selectedErrorReportV2.DisaMachine}</p>
                  <p><span className="font-bold">Problem:</span> {selectedErrorReportV2.Problem}</p>
                  <p><span className="font-bold">Action Taken:</span> {selectedErrorReportV2.CorrectiveAction}</p>
                </div>
                <label className="block text-gray-800 font-bold mb-2 text-sm">Supervisor Signature:</label>
                <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2">
                  <SignatureCanvas ref={errorSigCanvasV2} penColor="blue" canvasProps={{ className: 'w-full h-40 cursor-crosshair' }} />
                </div>
                <button onClick={() => errorSigCanvasV2.current.clear()} className="text-sm text-purple-600 hover:text-purple-800 font-bold underline mb-auto self-end float-right">Clear Pad</button>
                <div className="flex flex-col gap-3 mt-8">
                  <button onClick={submitErrorSignatureV2} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded font-bold shadow-md text-lg">Approve Plan V2</button>
                </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Supervisor;