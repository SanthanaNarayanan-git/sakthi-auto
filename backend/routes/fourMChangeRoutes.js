const express = require("express");
const router = express.Router();
const sql = require("mssql");
const PDFDocument = require("pdfkit");
const path = require("path");

/**
 * GET supervisors (replacing incharges) for the searchable dropdown
 */
router.get("/incharges", async (req, res) => {
  try {
    // Fetch from the Users table where role is 'supervisor'
    // Aliasing 'username' to 'name' so the frontend dropdown doesn't break
    const result = await sql.query`
      SELECT username AS name 
      FROM dbo.Users 
      WHERE role = 'supervisor'
      ORDER BY username ASC
    `;
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching supervisors:", err);
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
    partId, internalComm, inchargeSign
  } = req.body;

  try {
    await sql.query`
      INSERT INTO FourMChangeRecord (
        line, partName, recordDate, shift, mcNo, type4M, description,
        firstPart, lastPart, inspFreq, retroChecking, quarantine,
        partId, internalComm, inchargeSign
      ) VALUES (
        ${line}, ${partName}, ${recordDate}, ${shift}, ${mcNo}, ${type4M}, ${description},
        ${firstPart}, ${lastPart}, ${inspFreq}, ${retroChecking}, ${quarantine},
        ${partId}, ${internalComm}, ${inchargeSign}
      )
    `;
    res.json({ message: "Record saved successfully" });
  } catch (err) {
    console.error("Error inserting record:", err);
    res.status(500).json({ message: "Insert failed" });
  }
});

/**
 * GET PDF REPORT
 */
router.get("/report", async (req, res) => {
  try {
    const result = await sql.query`
      SELECT * FROM FourMChangeRecord
      ORDER BY id DESC
    `;

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=4M_Change_Report.pdf");
    doc.pipe(res);

    // Get Line from the most recent record
    const topRecord = result.recordset.length > 0 ? result.recordset[0] : {};
    const headerLine = topRecord.line || "DISA - I";
    
    // Get all unique part names from the database and join them with commas
    const uniquePartNames = [...new Set(
      result.recordset
        .map(row => row.partName)
        .filter(name => name && name.trim() !== "") // Remove empty names
    )];
    const headerPart = uniquePartNames.join(", ");

    const startX = 30;
    const startY = 30;
    
    // Column widths mapped directly to the 12 fields (Total: 780 to fit landscape)
    const colWidths = [60, 45, 45, 185, 40, 40, 40, 45, 60, 50, 60, 110];
    const rowHeight = 40;

    const headers = [
      "Date /\nShift", "M/c.\nNo", "Type of\n4M", "Description", 
      "First\nPart", "Last\nPart", "Insp.\nFreq", "Retro\nChecking", 
      "Quarantine", "Part\nIdent.", "Internal\nComm.", "Supervisor\nSign" // Changed Header text slightly
    ];

    // Helper: Draw Vector Tick, Cross, or standard Text
    const drawCellContent = (value, x, y, width) => {
      const centerX = x + width / 2;
      const centerY = y + 20; // Center vertically in the 40px row

      if (value === "OK") {
        // Draw a perfect vector Tick Mark (✓)
        doc.save();
        doc.lineWidth(1.5);
        doc.moveTo(centerX - 4, centerY + 2)
           .lineTo(centerX - 1, centerY + 6)
           .lineTo(centerX + 6, centerY - 4)
           .stroke();
        doc.restore();
      } else if (value === "Not OK") {
        // Draw a perfect vector Cross Mark (X)
        doc.save();
        doc.lineWidth(1.5);
        doc.moveTo(centerX - 4, centerY - 4)
           .lineTo(centerX + 4, centerY + 4)
           .moveTo(centerX + 4, centerY - 4)
           .lineTo(centerX - 4, centerY + 4)
           .stroke();
        doc.restore();
      } else if (value === "N" || value === "I" || value === "-") {
        // Standard text mapping
        doc.font("Helvetica").fontSize(10).text(value, x, y + 14, { width, align: "center" });
      } else {
        // Regular string output (like Descriptions)
        doc.font("Helvetica").fontSize(9).text(String(value || ""), x + 2, y + 5, { width: width - 4, align: "center" });
      }
      doc.font("Helvetica").fontSize(10); // reset font
    };

    // Helper: Draw Headers & Titles
    const drawHeaders = (y) => {
      // Top Title
      doc.font("Helvetica-Bold").fontSize(16).text("4M CHANGE MONITORING CHECK SHEET", startX, y, { align: "center" });
      
      // Top Left Line details
      doc.font("Helvetica-Bold").fontSize(12).text(`Line: ${headerLine}`, startX, y + 25);
      
      // Top Right Part Details (Now supports comma-separated multiple parts)
      doc.font("Helvetica-Bold").fontSize(12).text(`Part Name: ${headerPart}`, startX, y + 25, { 
        align: "right",
        width: doc.page.width - 60 // Prevents long lists from going off the page
      });

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

    // Draw initial header
    let y = drawHeaders(startY);

    // --- DRAW DATA ROWS ---
    result.recordset.forEach((row) => {
      if (y + rowHeight > doc.page.height - 50) {
        doc.addPage({ layout: "landscape", margin: 30 });
        y = drawHeaders(30); 
      }

      const formattedDate = new Date(row.recordDate).toLocaleDateString("en-GB");
      const dateShiftString = `${formattedDate}\nShift ${row.shift}`;

      const rowData = [
        dateShiftString, row.mcNo, row.type4M, row.description,
        row.firstPart, row.lastPart, row.inspFreq, row.retroChecking,
        row.quarantine, row.partId, row.internalComm, row.inchargeSign // the DB column is still called inchargeSign
      ];

      let x = startX;
      rowData.forEach((cell, i) => {
        doc.rect(x, y, colWidths[i], rowHeight).stroke();
        // Use our custom vector drawing function
        drawCellContent(cell, x, y, colWidths[i]);
        x += colWidths[i];
      });

      y += rowHeight;
    });

    // --- DRAW FOOTERS ---
    const drawFooter = () => {
      const footerY = doc.page.height - 30;
      doc.font("Helvetica").fontSize(8);
      
      // Left Footer
      doc.text("QF/07/MPD-36, Rev. No: 01, 13.03.2019", startX, footerY, { align: "left" });
      
      // Right Footer (HOD Sign)
      const rightX = doc.page.width - 130;
      doc.text("HOD Sign", rightX, footerY, { align: "right" });
      doc.moveTo(rightX + 20, footerY - 5).lineTo(rightX + 100, footerY - 5).stroke(); // Underline for sign
    };

    drawFooter(); // Add to the last page

    doc.end();
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ message: "Report generation failed" });
  }
});

module.exports = router;