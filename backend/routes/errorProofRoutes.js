const express = require("express");
const router = express.Router();
const sql = require("mssql");
const PDFDocument = require("pdfkit");

/**
 * GET next S.No
 */
router.get("/next-sno", async (req, res) => {
  try {
    const result = await sql.query`SELECT ISNULL(MAX(sNo), 0) + 1 AS nextSNo FROM ReactionPlan`;
    res.json({ nextSNo: result.recordset[0].nextSNo });
  } catch (err) {
    res.status(500).json({ message: "DB error" });
  }
});

/**
 * GET incharges
 */
router.get("/incharges", async (req, res) => {
  try {
    const result = await sql.query`SELECT name FROM Incharge ORDER BY name ASC`;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "DB error" });
  }
});

/**
 * INSERT Verification
 */
router.post("/add-verification", async (req, res) => {
  const { line, errorProofName, natureOfErrorProof, frequency, recordDate, shift, observationResult, verifiedBy, reviewedBy } = req.body;
  try {
    await sql.query`
      INSERT INTO ErrorProofVerification (line, errorProofName, natureOfErrorProof, frequency, recordDate, shift, observationResult, verifiedBy, reviewedBy)
      VALUES (${line}, ${errorProofName}, ${natureOfErrorProof}, ${frequency}, ${recordDate}, ${shift}, ${observationResult}, ${verifiedBy}, ${reviewedBy})
    `;
    res.json({ message: "Verification saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Insert failed" });
  }
});

/**
 * INSERT Reaction Plan
 */
router.post("/add-reaction", async (req, res) => {
  const { sNo, errorProofNo, errorProofName, recordDate, shift, problem, rootCause, correctiveAction, status, reviewedBy, approvedBy, remarks } = req.body;
  try {
    await sql.query`
      INSERT INTO ReactionPlan (sNo, errorProofNo, errorProofName, recordDate, shift, problem, rootCause, correctiveAction, status, reviewedBy, approvedBy, remarks)
      VALUES (${sNo}, ${errorProofNo}, ${errorProofName}, ${recordDate}, ${shift}, ${problem}, ${rootCause}, ${correctiveAction}, ${status}, ${reviewedBy}, ${approvedBy}, ${remarks})
    `;
    res.json({ message: "Reaction Plan saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Insert failed" });
  }
});

/**
 * GET PDF REPORT
 */
router.get("/report", async (req, res) => {
  try {
    const verificationResult = await sql.query`SELECT * FROM ErrorProofVerification ORDER BY recordDate ASC, id ASC`;
    const reactionResult = await sql.query`SELECT * FROM ReactionPlan ORDER BY id ASC`;

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape", bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=Error_Proof_Check_List.pdf");
    doc.pipe(res);

    const startX = 30;
    const startY = 30;

    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const wLine = 45, wName = 105, wNature = 140, wFreq = 55;
    const wDateBox = 135; 
    const wShift = wDateBox / 3; 

    const drawMainHeaders = (y, datesArr = []) => {
      doc.font("Helvetica-Bold").fontSize(14).text("ERROR PROOF VERIFICATION CHECK LIST - FDY", startX, y, { align: "center" });
      
      const headerTopY = y + 25;
      
      doc.rect(startX, headerTopY, wLine, 60).stroke();
      doc.text("Line", startX, headerTopY + 25, { width: wLine, align: "center" });

      let cx = startX + wLine;
      doc.rect(cx, headerTopY, wName, 60).stroke();
      doc.text("Error Proof\nName", cx, headerTopY + 20, { width: wName, align: "center" });

      cx += wName;
      doc.rect(cx, headerTopY, wNature, 60).stroke();
      doc.text("Nature of\nError Proof", cx, headerTopY + 20, { width: wNature, align: "center" });

      cx += wNature;
      doc.rect(cx, headerTopY, wFreq, 60).stroke();
      doc.text("Frequency\nS,D,W,M", cx, headerTopY + 15, { width: wFreq, align: "center" });

      cx += wFreq;
      for (let i = 0; i < 3; i++) {
        const boxX = cx + (i * wDateBox);
        
        doc.rect(boxX, headerTopY, wDateBox, 20).stroke();
        
        // Dynamically apply the chunked dates to the headers
        let dateLabel = "Date:";
        if (datesArr[i]) {
          dateLabel = `Date: ${formatDate(datesArr[i])}`;
        }
        
        doc.font("Helvetica-Bold").fontSize(9);
        doc.text(dateLabel, boxX + 2, headerTopY + 5, { width: wDateBox, align: "left" });

        doc.rect(boxX, headerTopY + 20, wShift, 20).stroke();
        doc.rect(boxX + wShift, headerTopY + 20, wShift, 20).stroke();
        doc.rect(boxX + (wShift*2), headerTopY + 20, wShift, 20).stroke();
        
        doc.fontSize(7);
        doc.text("Ist Shift", boxX, headerTopY + 25, { width: wShift, align: "center" });
        doc.text("IInd Shift", boxX + wShift, headerTopY + 25, { width: wShift, align: "center" });
        doc.text("IIIrd Shift", boxX + (wShift*2), headerTopY + 25, { width: wShift, align: "center" });
        
        doc.fontSize(6);
        doc.rect(boxX, headerTopY + 40, wShift, 20).stroke();
        doc.rect(boxX + wShift, headerTopY + 40, wShift, 20).stroke();
        doc.rect(boxX + (wShift*2), headerTopY + 40, wShift, 20).stroke();
        
        doc.text("Observation\nResult", boxX, headerTopY + 42, { width: wShift, align: "center" });
        doc.text("Observation\nResult", boxX + wShift, headerTopY + 42, { width: wShift, align: "center" });
        doc.text("Observation\nResult", boxX + (wShift*2), headerTopY + 42, { width: wShift, align: "center" });
      }

      return headerTopY + 60;
    };

    // ============================================================================
    // DATA GROUPING LOGIC (1 Row spans 3 Dates)
    // ============================================================================
    const allRecords = verificationResult.recordset;

    // 1. Get Unique Dates
    const uniqueDates = [...new Set(allRecords.map(r => {
      const d = new Date(r.recordDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }))].sort();

    // 2. Get Unique Error Proof Rows
    const uniqueProofsMap = new Map();
    allRecords.forEach(r => {
      if (!uniqueProofsMap.has(r.errorProofName)) {
        uniqueProofsMap.set(r.errorProofName, {
          line: r.line, nature: r.natureOfErrorProof, frequency: r.frequency
        });
      }
    });
    const uniqueProofs = Array.from(uniqueProofsMap.keys());

    // 3. Chunk Dates into groups of 3
    const dateChunks = [];
    if (uniqueDates.length === 0) {
      dateChunks.push([]); // Print empty form if DB is empty
    } else {
      for (let i = 0; i < uniqueDates.length; i += 3) {
        dateChunks.push(uniqueDates.slice(i, i + 3));
      }
    }

    let y = startY;

    // Draw Pages based on Date Chunks (3 Days per Page)
    dateChunks.forEach((chunk, chunkIndex) => {
      if (chunkIndex > 0) {
        doc.addPage({ layout: "landscape", margin: 30 });
        y = startY;
      }
      
      y = drawMainHeaders(y, chunk);

      uniqueProofs.forEach((proofName) => {
        const proofData = uniqueProofsMap.get(proofName);

        doc.font("Helvetica").fontSize(8);
        const nameHeight = doc.heightOfString(proofName || "", { width: wName - 8, align: "center" });
        const natureHeight = doc.heightOfString(proofData.nature || "", { width: wNature - 8, align: "center" });
        const freqHeight = doc.heightOfString(proofData.frequency || "", { width: wFreq - 8, align: "center" });
        let rowHeight = Math.max(50, nameHeight + 20, natureHeight + 20, freqHeight + 20); 

        if (y + rowHeight > doc.page.height - 60) {
          doc.font("Helvetica-Bold").fontSize(9);
          doc.text("QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023", startX, y + 10, { align: "left" });
          doc.addPage({ layout: "landscape", margin: 30 });
          y = drawMainHeaders(30, chunk); 
        }

        let cx = startX;
        doc.rect(cx, y, wLine, rowHeight).stroke();
        doc.text(proofData.line || "", cx + 2, y + (rowHeight/2 - 5), { width: wLine - 4, align: "center" });
        cx += wLine;

        doc.rect(cx, y, wName, rowHeight).stroke();
        doc.text(proofName || "", cx + 4, y + 10, { width: wName - 8, align: "center" });
        cx += wName;

        doc.rect(cx, y, wNature, rowHeight).stroke();
        doc.text(proofData.nature || "", cx + 4, y + 10, { width: wNature - 8, align: "center" });
        cx += wNature;

        doc.rect(cx, y, wFreq, rowHeight).stroke();
        doc.text(proofData.frequency || "", cx + 4, y + 10, { width: wFreq - 8, align: "center" });
        cx += wFreq;

        for (let i = 0; i < 9; i++) {
          doc.rect(cx + (i * wShift), y, wShift, rowHeight).stroke();
        }

        // =========================================================
        // PLOT DATA EXACTLY IN THE RIGHT SHIFT CELL
        // =========================================================
        chunk.forEach((dateStr, dateIndex) => {
          const recordsForDateAndProof = allRecords.filter(r => {
            const d = new Date(r.recordDate);
            const rDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return rDateStr === dateStr && r.errorProofName === proofName;
          });

          recordsForDateAndProof.forEach(record => {
            let shiftOffset = 0;
            if (record.shift === "II") shiftOffset = 1;
            if (record.shift === "III") shiftOffset = 2;

            const cellIndex = (dateIndex * 3) + shiftOffset;
            const targetX = cx + (cellIndex * wShift);
            const targetY = y + (rowHeight / 2) - 8;

            doc.fontSize(7);
            if (record.observationResult === "OK") {
              doc.text("Checked\nOK", targetX, targetY, { width: wShift, align: "center" });
            } else if (record.observationResult === "NOT_OK") {
              doc.text("Checked\nNot OK", targetX, targetY, { width: wShift, align: "center" });
            }
          });
        });

        y += rowHeight;
      });

      // Part A Page Footer
      doc.font("Helvetica-Bold").fontSize(9);
      doc.text("QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023", startX, y + 10, { align: "left" });
    });

    // ============================================================================
    // PART B: REACTION PLAN TABLE
    // ============================================================================
    if (reactionResult.recordset.length > 0) {
      doc.addPage({ layout: "landscape", margin: 30 });
      
      const rColWidths = [30, 50, 90, 60, 80, 80, 80, 50, 70, 70, 90];
      const rHeaders = ["S.No", "Error\nProof No", "Error proof\nName", "Date /\nShift", "Problem", "Root Cause", "Corrective\naction", "Status", "Reviewed\nBy", "Approved\nBy", "Remarks"];

      const drawReactionHeaders = (ry) => {
        doc.font("Helvetica-Bold").fontSize(14).text("REACTION PLAN", startX, ry, { align: "center" });
        const headerY = ry + 25;
        doc.fontSize(8);
        
        let currX = startX;
        rHeaders.forEach((h, i) => {
          doc.rect(currX, headerY, rColWidths[i], 30).stroke();
          doc.text(h, currX + 2, headerY + 5, { width: rColWidths[i] - 4, align: "center" });
          currX += rColWidths[i];
        });
        return headerY + 30;
      };

      let ry = drawReactionHeaders(30);

      reactionResult.recordset.forEach((rRow) => {
        doc.font("Helvetica").fontSize(8);

        const dDate = new Date(rRow.recordDate);
        const dateStr = !isNaN(dDate) ? `${String(dDate.getDate()).padStart(2, '0')}/${String(dDate.getMonth() + 1).padStart(2, '0')}/${dDate.getFullYear()}` : "";
        const dateShiftStr = `${dateStr}\nShift ${rRow.shift || ""}`;

        const hName = doc.heightOfString(rRow.errorProofName || "", { width: rColWidths[2] - 8, align: "center" });
        const hProb = doc.heightOfString(rRow.problem || "", { width: rColWidths[4] - 8, align: "center" });
        const hRoot = doc.heightOfString(rRow.rootCause || "", { width: rColWidths[5] - 8, align: "center" });
        const hCorr = doc.heightOfString(rRow.correctiveAction || "", { width: rColWidths[6] - 8, align: "center" });
        const hRemk = doc.heightOfString(rRow.remarks || "", { width: rColWidths[10] - 8, align: "center" });
        
        let rRowHeight = Math.max(40, hName + 15, hProb + 15, hRoot + 15, hCorr + 15, hRemk + 15);

        if (ry + rRowHeight > doc.page.height - 60) {
          doc.font("Helvetica-Bold").fontSize(9);
          doc.text("QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023", startX, ry + 10, { align: "left" });

          doc.addPage({ layout: "landscape", margin: 30 });
          ry = drawReactionHeaders(30);
        }

        const rowData = [
          rRow.sNo || "", 
          rRow.errorProofNo || "", 
          rRow.errorProofName || "", 
          dateShiftStr, 
          rRow.problem || "", 
          rRow.rootCause || "", 
          rRow.correctiveAction || "", 
          rRow.status || "", 
          rRow.reviewedBy || "", 
          rRow.approvedBy || "", 
          rRow.remarks || ""
        ];

        let currX = startX;
        rowData.forEach((cellText, i) => {
          doc.rect(currX, ry, rColWidths[i], rRowHeight).stroke();
          
          const textY = (i === 4 || i === 5 || i === 6 || i === 10 || i === 2) ? ry + 5 : ry + (rRowHeight / 2) - 5;
          doc.text(String(cellText), currX + 4, textY, { width: rColWidths[i] - 8, align: "center" });
          currX += rColWidths[i];
        });

        ry += rRowHeight;
      });

      doc.font("Helvetica-Bold").fontSize(9);
      doc.text("QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023", startX, ry + 10, { align: "left" });
    }

    doc.end();
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ message: "Report generation failed" });
  }
});

module.exports = router;