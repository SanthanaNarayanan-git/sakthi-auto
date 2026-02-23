const express = require("express");
const router = express.Router();
const sql = require("mssql");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

/**
 * GET previous mould count
 */
router.get("/last-mould-count", async (req, res) => {
  try {
    const result = await sql.query`
      SELECT TOP 1 mouldCountNo 
      FROM DISASettingAdjustmentRecord
      ORDER BY id DESC
    `;

    const prev = result.recordset.length > 0 ? result.recordset[0].mouldCountNo : 0;
    res.json({ prevMouldCountNo: prev });
  } catch (err) {
    console.error("Error fetching last mould count:", err);
    res.status(500).json({ message: "DB error" });
  }
});

/**
 * INSERT record
 */
router.post("/add", async (req, res) => {
  const {
    recordDate,
    mouldCountNo,
    prevMouldCountNo,
    noOfMoulds,
    workCarriedOut,
    preventiveWorkCarried,
    remarks
  } = req.body;

  try {
    await sql.query`
      INSERT INTO DISASettingAdjustmentRecord (
        recordDate, mouldCountNo, prevMouldCountNo, noOfMoulds, workCarriedOut, preventiveWorkCarried, remarks
      ) VALUES (
        ${recordDate}, ${mouldCountNo}, ${prevMouldCountNo}, ${noOfMoulds}, ${workCarriedOut}, ${preventiveWorkCarried}, ${remarks}
      )
    `;

    res.json({ message: "Record saved successfully" });
  } catch (err) {
    console.error("Error inserting record:", err);
    res.status(500).json({ message: "Insert failed" });
  }
});

/**
 * GET PDF Report
 */
router.get("/report", async (req, res) => {
  try {
    // ---------------------------------------------------------
    // CHANGED HERE: Added 'ORDER BY id DESC' to guarantee the 
    // exact descending order of when they were added.
    // ---------------------------------------------------------
    const result = await sql.query`
      SELECT 
        recordDate,
        mouldCountNo,
        noOfMoulds,
        workCarriedOut,
        preventiveWorkCarried,
        remarks
      FROM DISASettingAdjustmentRecord
      ORDER BY id DESC 
    `;

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=DISA_Report.pdf");

    doc.pipe(res);

    const startX = 30;
    const startY = 30;
    const pageWidth = doc.page.width - 60; 
    
    const colWidths = [80, 110, 80, 200, 200, pageWidth - 670]; 
    const logoBoxWidth = colWidths[0] + colWidths[1]; 
    const titleBoxWidth = pageWidth - logoBoxWidth;   

    const headerHeight = 60; 
    const minRowHeight = 35;    

    const headers = [
      "Date",
      "Mould Count Number",
      "No. of Moulds",
      "Work Carried Out",
      "Preventive Work Carried",
      "Remarks"
    ];

    // Helper: Draw Headers
    const drawHeaders = (y) => {
      doc.rect(startX, y, logoBoxWidth, headerHeight).stroke();
      doc.rect(startX + logoBoxWidth, y, titleBoxWidth, headerHeight).stroke();

      const logoPath = path.join(__dirname, "logo.jpg");
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 15, y + 10, { 
          fit: [logoBoxWidth - 30, headerHeight - 20],
          align: 'center',
          valign: 'center'
        });
      }

      doc.font("Helvetica-Bold").fontSize(22);
      doc.text("DISA SETTING ADJUSTMENT RECORD", startX + logoBoxWidth, y + 20, {
        width: titleBoxWidth,
        align: "center"
      });

      const tableHeaderY = y + headerHeight;
      let currentX = startX;

      doc.font("Helvetica-Bold").fontSize(10);
      headers.forEach((header, i) => {
        doc.rect(currentX, tableHeaderY, colWidths[i], minRowHeight).stroke();
        doc.text(header, currentX + 5, tableHeaderY + 12, {
          width: colWidths[i] - 10,
          align: "center"
        });
        currentX += colWidths[i];
      });

      return tableHeaderY + minRowHeight;
    };

    // Helper: Draw Footer exactly below the table
    const drawFooter = (yPos) => {
      doc.font("Helvetica").fontSize(8);
      const controlText = "QF/07/FBP-02, Rev. No.01 Dt 14.05.2025";
      
      const textY = yPos + 10; // 10px spacing below table
      doc.text(controlText, startX, textY, { align: "left" });

      const textWidth = doc.widthOfString(controlText);
      doc.moveTo(startX, textY + 12)
         .lineTo(startX + textWidth, textY + 12)
         .lineWidth(1)
         .stroke();
    };

    let y = drawHeaders(startY);

    // --- DRAW DATA ROWS ---
    result.recordset.forEach((row) => {
      const formattedDate = new Date(row.recordDate).toLocaleDateString("en-GB");

      // Set up row data and check for old records that used commas instead of bullets
      const processText = (text) => {
        if (!text) return "";
        // Backwards compatibility: if old data has commas but no bullets, format it.
        if (text.includes(",") && !text.includes("•")) {
          return text.split(",").map(item => `• ${item.trim()}`).join("\n");
        }
        return text;
      };

      const rowData = [
        formattedDate,
        row.mouldCountNo,
        row.noOfMoulds,
        processText(row.workCarriedOut),
        processText(row.preventiveWorkCarried),
        row.remarks
      ];

      // 1. Calculate dynamic row height based on the text length (for multiple bullets)
      let maxRowHeight = minRowHeight;
      doc.font("Helvetica").fontSize(10);
      
      rowData.forEach((cell, i) => {
        const textHeight = doc.heightOfString(String(cell || ""), {
          width: colWidths[i] - 10,
          align: "center"
        });
        if (textHeight + 20 > maxRowHeight) { // +20 for top/bottom padding
          maxRowHeight = textHeight + 20;
        }
      });

      // 2. Check if row + footer exceeds page. If so, draw footer, add page, draw headers.
      if (y + maxRowHeight + 30 > doc.page.height - 30) {
        drawFooter(y);
        doc.addPage({ layout: "landscape", margin: 30 });
        y = drawHeaders(30); 
        doc.font("Helvetica").fontSize(10); 
      }

      // 3. Draw the cells
      let x = startX;
      rowData.forEach((cell, i) => {
        doc.rect(x, y, colWidths[i], maxRowHeight).stroke();
        doc.text(String(cell || ""), x + 5, y + 10, {
          width: colWidths[i] - 10,
          align: "center" // Keep bullets centered per original layout
        });
        x += colWidths[i];
      });

      y += maxRowHeight;
    });

    // Draw footer at the very end of the final page
    drawFooter(y);

    doc.end();
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ message: "Report generation failed" });
  }
});

module.exports = router;