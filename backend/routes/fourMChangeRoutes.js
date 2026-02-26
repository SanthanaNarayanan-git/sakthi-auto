const express = require("express");
const router = express.Router();
const sql = require("mssql");
const PDFDocument = require("pdfkit");

/**
 * GET supervisors AND hods for the dropdowns
 */
router.get("/incharges", async (req, res) => {
  try {
    const supRes = await sql.query`SELECT username AS name FROM dbo.Users WHERE role = 'supervisor' ORDER BY username ASC`;
    const hodRes = await sql.query`SELECT username AS name FROM dbo.Users WHERE role = 'hod' ORDER BY username ASC`;
    res.json({ supervisors: supRes.recordset, hods: hodRes.recordset });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "DB error" });
  }
});

router.get("/types", async (req, res) => {
  try {
    const result = await sql.query`SELECT typeName FROM FourMTypes ORDER BY id ASC`;
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching 4M Types:", err);
    res.status(500).json({ message: "DB error" });
  }
});

/**
 * INSERT RECORD
 */
router.post("/add", async (req, res) => {
  const {
    line, partName, recordDate, shift, mcNo, type4M, description,
    firstPart, lastPart, inspFreq, retroChecking, quarantine,
    partId, internalComm, inchargeSign, assignedHOD
  } = req.body;

  try {
    await sql.query`
      INSERT INTO FourMChangeRecord (
        line, partName, recordDate, shift, mcNo, type4M, description,
        firstPart, lastPart, inspFreq, retroChecking, quarantine,
        partId, internalComm, inchargeSign, AssignedHOD
      ) VALUES (
        ${line}, ${partName}, ${recordDate}, ${shift}, ${mcNo}, ${type4M}, ${description},
        ${firstPart}, ${lastPart}, ${inspFreq}, ${retroChecking}, ${quarantine},
        ${partId}, ${internalComm}, ${inchargeSign}, ${assignedHOD}
      )
    `;
    res.json({ message: "Record saved successfully" });
  } catch (err) {
    console.error("Error inserting record:", err);
    res.status(500).json({ message: "Insert failed" });
  }
});

// ==========================================
//        SUPERVISOR API
// ==========================================
router.get("/supervisor/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const result = await sql.query`
        SELECT id, recordDate, shift, line as disa, partName, mcNo, type4M, description, SupervisorSignature
        FROM FourMChangeRecord WHERE inchargeSign = ${name} ORDER BY recordDate DESC, shift ASC
      `;
      res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});
  
router.post("/sign-supervisor", async (req, res) => {
    try {
      const { reportId, signature } = req.body;
      await sql.query`UPDATE FourMChangeRecord SET SupervisorSignature = ${signature} WHERE id = ${reportId}`;
      res.json({ message: "Signature saved successfully" });
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});

// ==========================================
//        HOD DASHBOARD APIS 
// ==========================================
router.get("/hod/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const result = await sql.query`
        SELECT id, recordDate, shift, line as disa, partName, mcNo, type4M, description, HODSignature
        FROM FourMChangeRecord WHERE AssignedHOD = ${name} ORDER BY recordDate DESC, shift ASC
      `;
      res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});
  
router.post("/sign-hod", async (req, res) => {
    try {
      const { reportId, signature } = req.body;
      await sql.query`UPDATE FourMChangeRecord SET HODSignature = ${signature} WHERE id = ${reportId}`;
      res.json({ message: "HOD Signature saved successfully" });
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});

// ==========================================
//        PDF GENERATOR
// ==========================================
router.get("/report", async (req, res) => {
  try {
    const { reportId } = req.query;

    let query = `SELECT * FROM FourMChangeRecord`;
    if (reportId) query += ` WHERE id = ${reportId}`;
    else query += ` ORDER BY id DESC`;

    const result = await sql.query(query);

    // 🔥 Explicitly disable autoPageBreak to take full manual control
    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape", autoPageBreak: false });
    const PAGE_HEIGHT = 595.28; 
    const PAGE_WIDTH = 841.89;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=4M_Change_Report.pdf");
    doc.pipe(res);

    const topRecord = result.recordset.length > 0 ? result.recordset[0] : {};
    const headerLine = topRecord.line || "DISA - I";
    const hodSignature = topRecord.HODSignature;
    
    const uniquePartNames = [...new Set(result.recordset.map(row => row.partName).filter(name => name && name.trim() !== ""))];
    const headerPart = uniquePartNames.join(", ");

    const startX = 30;
    const startY = 30;
    const colWidths = [60, 45, 45, 185, 40, 40, 40, 45, 60, 50, 60, 110];
    const rowHeight = 40;

    const headers = [
      "Date /\nShift", "M/c.\nNo", "Type of\n4M", "Description", 
      "First\nPart", "Last\nPart", "Insp.\nFreq", "Retro\nChecking", 
      "Quarantine", "Part\nIdent.", "Internal\nComm.", "Supervisor\nSign"
    ];

    // 🔥 FIX: Calculated precisely to never hit the bottom 30px margin
    const drawFooter = () => {
      const footerY = PAGE_HEIGHT - 45; // Moved up away from margin boundary
      
      doc.font("Helvetica-Bold").fontSize(9);
      // lineBreak: false ensures the text never wraps or tries to push downward
      doc.text("QF/07/MPD-36, Rev. No: 01, 13.03.2019", startX, footerY, { align: "left", lineBreak: false });
      
      const rightX = PAGE_WIDTH - 200;
      doc.text("HOD Sign:", rightX, footerY, { align: "left", lineBreak: false });
      
      if (hodSignature && hodSignature.startsWith('data:image')) {
          try {
              const base64Data = hodSignature.split('base64,')[1];
              const imgBuffer = Buffer.from(base64Data, 'base64');
              // Drawn directly over the text baseline so it stays strictly inside the safe zone
              doc.image(imgBuffer, rightX + 50, footerY - 20, { fit: [80, 30] });
          } catch(e) { console.error("HOD Sig error", e); }
      } else {
          doc.moveTo(rightX + 50, footerY + 10).lineTo(rightX + 130, footerY + 10).stroke();
      }
    };

    const drawCellContent = (value, x, y, width, isSignature = false) => {
      const centerX = x + width / 2;
      const centerY = y + 20;

      if (isSignature && value && value.startsWith('data:image')) {
          try {
              const base64Data = value.split('base64,')[1];
              const imgBuffer = Buffer.from(base64Data, 'base64');
              doc.image(imgBuffer, x + 5, y + 2, { fit: [width - 10, rowHeight - 4] });
          } catch(e) { }
      } else if (value === "OK") {
        doc.save(); doc.lineWidth(1.5); doc.moveTo(centerX - 4, centerY + 2).lineTo(centerX - 1, centerY + 6).lineTo(centerX + 6, centerY - 4).stroke(); doc.restore();
      } else if (value === "Not OK") {
        doc.save(); doc.lineWidth(1.5); doc.moveTo(centerX - 4, centerY - 4).lineTo(centerX + 4, centerY + 4).moveTo(centerX + 4, centerY - 4).lineTo(centerX - 4, centerY + 4).stroke(); doc.restore();
      } else if (value === "N" || value === "I" || value === "-") {
        doc.font("Helvetica").fontSize(10).text(value, x, y + 14, { width, align: "center", lineBreak: false });
      } else {
        doc.font("Helvetica").fontSize(9).text(String(value || ""), x + 2, y + 5, { width: width - 4, height: rowHeight - 10, align: "center", ellipsis: true });
      }
      doc.font("Helvetica").fontSize(10);
    };

    const drawHeaders = (y) => {
      doc.font("Helvetica-Bold").fontSize(16).text("4M CHANGE MONITORING CHECK SHEET", startX, y, { align: "center" });
      doc.font("Helvetica-Bold").fontSize(12).text(`Line: ${headerLine}`, startX, y + 25);
      doc.font("Helvetica-Bold").fontSize(12).text(`Part Name: ${headerPart}`, startX, y + 25, { align: "right", width: PAGE_WIDTH - 60 });

      const tableHeaderY = y + 50;
      let currentX = startX;

      doc.font("Helvetica-Bold").fontSize(9);
      headers.forEach((header, i) => {
        doc.rect(currentX, tableHeaderY, colWidths[i], rowHeight).stroke();
        doc.text(header, currentX, tableHeaderY + 8, { width: colWidths[i], align: "center" });
        currentX += colWidths[i];
      });

      return tableHeaderY + rowHeight;
    };

    let y = drawHeaders(startY);

    result.recordset.forEach((row) => {
      // 🔥 FIX: We now stop creating rows well before we hit the footer zone (PAGE_HEIGHT - 80)
      if (y + rowHeight > PAGE_HEIGHT - 80) { 
        drawFooter(); // Securely stamp the footer on the current page
        doc.addPage({ layout: "landscape", margin: 30, autoPageBreak: false });
        y = drawHeaders(30); 
      }

      const d = new Date(row.recordDate);
      const formattedDate = !isNaN(d) ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : "";
      const dateShiftString = `${formattedDate}\nShift ${row.shift}`;

      const rowData = [ dateShiftString, row.mcNo, row.type4M, row.description, row.firstPart, row.lastPart, row.inspFreq, row.retroChecking, row.quarantine, row.partId, row.internalComm, row.SupervisorSignature ];

      let x = startX;
      rowData.forEach((cell, i) => {
        doc.rect(x, y, colWidths[i], rowHeight).stroke();
        drawCellContent(cell, x, y, colWidths[i], (i === 11));
        x += colWidths[i];
      });
      y += rowHeight;
    });

    // Ensure the footer is drawn on the very last page
    drawFooter();

    doc.end();
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ message: "Report generation failed" });
  }
});

module.exports = router;