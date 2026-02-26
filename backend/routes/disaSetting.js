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
 * INSERT record (Updated to include operatorSignature)
 */
router.post("/add", async (req, res) => {
  const {
    recordDate,
    mouldCountNo,
    prevMouldCountNo,
    noOfMoulds,
    workCarriedOut,
    preventiveWorkCarried,
    operatorSignature, // 🔥 NEW FIELD
    remarks
  } = req.body;

  try {
    await sql.query`
      INSERT INTO DISASettingAdjustmentRecord (
        recordDate, mouldCountNo, prevMouldCountNo, noOfMoulds, workCarriedOut, preventiveWorkCarried, operatorSignature, remarks
      ) VALUES (
        ${recordDate}, ${mouldCountNo}, ${prevMouldCountNo}, ${noOfMoulds}, ${workCarriedOut}, ${preventiveWorkCarried}, ${operatorSignature || null}, ${remarks}
      )
    `;

    res.json({ message: "Record saved successfully" });
  } catch (err) {
    console.error("Error inserting record:", err);
    res.status(500).json({ message: "Insert failed" });
  }
});

/**
 * GET PDF Report (Updated to draw the signature)
 */
router.get("/report", async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        recordDate,
        mouldCountNo,
        noOfMoulds,
        workCarriedOut,
        preventiveWorkCarried,
        operatorSignature, -- 🔥 Fetch the signature
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
    
    // 🔥 Adjusted column widths to make room for the new Signature column
    const colWidths = [70, 90, 70, 180, 180, 100, pageWidth - 690]; 
    const logoBoxWidth = colWidths[0] + colWidths[1]; 
    const titleBoxWidth = pageWidth - logoBoxWidth;   

    const headerHeight = 60; 
    const minRowHeight = 45;    

    const headers = [
      "Date",
      "Mould Count Number",
      "No. of Moulds",
      "Work Carried Out",
      "Preventive Work Carried",
      "Operator Signature", // 🔥 NEW HEADER
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

      const processText = (text) => {
        if (!text) return "";
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
        row.operatorSignature, // 🔥 Base64 String
        row.remarks
      ];

      // 1. Calculate dynamic row height
      let maxRowHeight = minRowHeight;
      doc.font("Helvetica").fontSize(10);
      
      rowData.forEach((cell, i) => {
        // Skip height calculation for the signature image column
        if (i === 5) return; 
        
        const textHeight = doc.heightOfString(String(cell || ""), {
          width: colWidths[i] - 10,
          align: "center"
        });
        if (textHeight + 20 > maxRowHeight) { 
          maxRowHeight = textHeight + 20;
        }
      });

      // 2. Check if row + footer exceeds page.
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
        
        // 🔥 If it's the signature column and it contains data, draw the image
        if (i === 5 && cell && cell.startsWith("data:image")) {
          try {
            // Draw the base64 image inside the cell
            doc.image(cell, x + 5, y + 5, {
              fit: [colWidths[i] - 10, maxRowHeight - 10], // Fit inside cell padding
              align: 'center',
              valign: 'center'
            });
          } catch (imgErr) {
            console.error("Could not draw signature image:", imgErr);
            doc.text("Invalid Sig", x + 5, y + 10, { width: colWidths[i] - 10, align: "center" });
          }
        } 
        // Otherwise, draw normal text
        else if (i !== 5) {
          doc.text(String(cell || ""), x + 5, y + 10, {
            width: colWidths[i] - 10,
            align: "center" 
          });
        }
        
        x += colWidths[i];
      });

      y += maxRowHeight;
    });

    drawFooter(y);

    doc.end();
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ message: "Report generation failed" });
  }
});

module.exports = router;